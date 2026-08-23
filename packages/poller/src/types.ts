import type { AtsType, DiscoveredPosting, SourceDefinition } from "@internship-radar/core";

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface AdapterRequest {
  readonly url: string;
  readonly init?: RequestInit;
}

export interface SourceAdapter {
  readonly ats: AtsType;
  buildRequest(source: SourceDefinition): AdapterRequest;
  parse(payload: unknown, source: SourceDefinition): readonly DiscoveredPosting[];
}

export type SourceIssueKind = "timeout" | "rate_limited" | "server_error" | "http_error" | "network_error" | "malformed_payload";

export interface SourceIssue {
  readonly kind: SourceIssueKind;
  readonly retryable: boolean;
  readonly status?: number;
  readonly retryAfterMs?: number;
  readonly message: string;
}

export interface AdapterRunResult {
  readonly source: SourceDefinition;
  readonly status: "success" | "empty" | "failed";
  readonly postings: readonly DiscoveredPosting[];
  readonly attempts: number;
  readonly durationMs: number;
  readonly issue?: SourceIssue;
}
