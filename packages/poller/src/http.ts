import type { AdapterRequest, FetchLike, SourceIssue, SourceIssueKind } from "./types";

export const DEFAULT_SOURCE_TIMEOUT_MS = 8_000;
export const DEFAULT_MAX_ATTEMPTS = 3;

export class SourceRequestError extends Error {
  constructor(
    readonly kind: SourceIssueKind,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "SourceRequestError";
  }
}

function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1_000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - now);
}

function issueFromStatus(status: number, retryAfter: string | null, now: number): SourceRequestError {
  if (status === 429) {
    return new SourceRequestError("rate_limited", "source rate limited the request", true, status, parseRetryAfter(retryAfter, now));
  }
  if (status >= 500) return new SourceRequestError("server_error", `source returned HTTP ${status}`, true, status);
  return new SourceRequestError("http_error", `source returned HTTP ${status}`, false, status);
}

function toIssue(error: unknown): SourceRequestError {
  if (error instanceof SourceRequestError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new SourceRequestError("timeout", "source request exceeded its time budget", true);
  }
  return new SourceRequestError("network_error", "source request failed before a response was received", true);
}

export interface RequestJsonOptions {
  readonly fetchImpl?: FetchLike;
  readonly renderFetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly jitter?: (maximum: number) => number;
}

export interface SourceResponse {
  readonly payload: unknown;
  readonly attempts: number;
}

export async function requestSource(request: AdapterRequest, options: RequestJsonOptions = {}): Promise<SourceResponse> {
  const fetchImpl = request.transport === "browser"
    ? options.renderFetchImpl
    : options.fetchImpl ?? fetch;
  if (fetchImpl === undefined) {
    throw new SourceRequestError("network_error", "rendered source transport is unavailable", false);
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_SOURCE_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const jitter = options.jitter ?? ((maximum) => Math.floor(Math.random() * maximum));

  let lastError: SourceRequestError | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(request.url, { ...request.init, signal: controller.signal });
      if (!response.ok) throw issueFromStatus(response.status, response.headers.get("retry-after"), now());
      try {
        return { payload: request.responseType === "text" ? await response.text() : await response.json(), attempts: attempt };
      } catch {
        throw new SourceRequestError(
          "malformed_payload",
          request.responseType === "text" ? "source returned unreadable text" : "source returned invalid JSON",
          false,
          response.status,
        );
      }
    } catch (error) {
      lastError = toIssue(error);
      if (!lastError.retryable || attempt === maxAttempts) throw lastError;
      const exponential = Math.min(4_000, 250 * (2 ** (attempt - 1)));
      const delay = lastError.retryAfterMs ?? (exponential + jitter(250));
      await sleep(delay);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new SourceRequestError("network_error", "source request failed", true);
}

export const requestJson = requestSource;

export function sanitizeSourceIssue(error: unknown): SourceIssue {
  const issue = toIssue(error);
  return {
    kind: issue.kind,
    retryable: issue.retryable,
    ...(issue.status === undefined ? {} : { status: issue.status }),
    ...(issue.retryAfterMs === undefined ? {} : { retryAfterMs: issue.retryAfterMs }),
    message: issue.message,
  };
}
