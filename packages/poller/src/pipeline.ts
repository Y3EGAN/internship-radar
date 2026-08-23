import type { AtsType, SourceDefinition } from "@internship-radar/core";
import { deduplicatePostings, type DeduplicationWarning } from "./deduplication";
import { requestJson, sanitizeSourceIssue, SourceRequestError, type RequestJsonOptions } from "./http";
import type { AdapterRunResult, SourceAdapter } from "./types";

export interface DiscoveryResult {
  readonly status: "success" | "partial" | "failed";
  readonly sources: readonly AdapterRunResult[];
  readonly postings: ReturnType<typeof deduplicatePostings>["postings"];
  readonly warnings: readonly DeduplicationWarning[];
}

export async function runSource(
  source: SourceDefinition,
  adapter: SourceAdapter,
  options: RequestJsonOptions & { readonly clock?: () => number } = {},
): Promise<AdapterRunResult> {
  const clock = options.clock ?? Date.now;
  const startedAt = clock();
  let attempts = 0;
  try {
    const response = await requestJson(adapter.buildRequest(source), options);
    attempts = response.attempts;
    let postings;
    try {
      postings = adapter.parse(response.payload, source);
    } catch {
      throw new SourceRequestError("malformed_payload", "source payload did not match the adapter contract", false);
    }
    return {
      source,
      status: postings.length === 0 ? "empty" : "success",
      postings,
      attempts,
      durationMs: Math.max(0, clock() - startedAt),
    };
  } catch (error) {
    return {
      source,
      status: "failed",
      postings: [],
      attempts: attempts > 0 ? attempts : error instanceof SourceRequestError && error.retryable ? (options.maxAttempts ?? 3) : 1,
      durationMs: Math.max(0, clock() - startedAt),
      issue: sanitizeSourceIssue(error),
    };
  }
}

export async function runDiscovery(
  sources: readonly SourceDefinition[],
  adapters: ReadonlyMap<AtsType, SourceAdapter>,
  options: RequestJsonOptions = {},
): Promise<DiscoveryResult> {
  const results = await Promise.all(sources.map(async (source) => {
    const adapter = adapters.get(source.ats);
    if (adapter === undefined) {
      return {
        source,
        status: "failed",
        postings: [],
        attempts: 0,
        durationMs: 0,
        issue: { kind: "malformed_payload", retryable: false, message: "no adapter is registered for this source type" },
      } satisfies AdapterRunResult;
    }
    return runSource(source, adapter, options);
  }));

  const deduplicated = deduplicatePostings(results.flatMap((result) => result.postings));
  const failed = results.filter((result) => result.status === "failed").length;
  return {
    status: failed === 0 ? "success" : failed === results.length ? "failed" : "partial",
    sources: results,
    postings: deduplicated.postings,
    warnings: deduplicated.warnings,
  };
}
