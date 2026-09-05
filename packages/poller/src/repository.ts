import type { DiscoveredPosting, ScoredPosting, SourceDefinition } from "@internship-radar/core";

type RpcResult<T> = PromiseLike<{ readonly data: T | null; readonly error: { readonly code?: string } | null }>;

export interface PollerRpcClient {
  rpc(functionName: string, args: Readonly<Record<string, unknown>>): RpcResult<unknown>;
}

export interface PersistedPosting {
  readonly jobId: number;
  readonly sourceNew: boolean;
  readonly contentChanged: boolean;
}

export class PersistenceError extends Error {
  constructor(readonly operation: string, readonly code?: string) {
    super(`database operation failed: ${operation}`);
    this.name = "PersistenceError";
  }
}

async function callRpc<T>(
  client: PollerRpcClient,
  operation: string,
  args: Readonly<Record<string, unknown>>,
): Promise<T> {
  const result = await client.rpc(operation, args);
  if (result.error !== null || result.data === null) {
    throw new PersistenceError(operation, result.error?.code);
  }
  return result.data as T;
}

export function startSourceRun(
  client: PollerRpcClient,
  ownerId: string,
  workflowRunId: string,
  partitionKey: string,
): Promise<number> {
  return callRpc(client, "start_source_run", {
    p_owner_id: ownerId,
    p_workflow_run_id: workflowRunId,
    p_partition_key: partitionKey,
  });
}

export async function tryStartSourceRun(
  client: PollerRpcClient,
  ownerId: string,
  workflowRunId: string,
  partitionKey: string,
): Promise<number | null> {
  const result = await client.rpc("try_start_source_run", {
    p_owner_id: ownerId,
    p_workflow_run_id: workflowRunId,
    p_partition_key: partitionKey,
  });
  if (result.error !== null) throw new PersistenceError("try_start_source_run", result.error.code);
  return result.data as number | null;
}

export async function persistPosting(
  client: PollerRpcClient,
  source: SourceDefinition,
  posting: DiscoveredPosting,
  score: ScoredPosting,
  alert?: { readonly sourceRunId: number; readonly recipient: string },
): Promise<PersistedPosting> {
  const rows = await callRpc<ReadonlyArray<{
    job_id: number;
    source_new: boolean;
    content_changed: boolean;
  }>>(client, alert === undefined ? "upsert_discovered_job" : "upsert_discovered_job_with_alert", {
    p_owner_id: source.ownerId,
    p_source_endpoint_id: source.id,
    p_external_job_id: posting.externalJobId,
    p_employer_name: posting.companyName,
    p_title: posting.title,
    p_normalized_title: posting.normalizedTitle,
    p_canonical_url: posting.canonicalUrl,
    p_source_url: posting.sourceUrl,
    p_description: posting.description,
    p_location_text: posting.location,
    p_normalized_location: posting.normalizedLocation,
    p_role_family: posting.department ?? null,
    p_posted_at: posting.postedAt ?? null,
    p_closes_at: posting.closesAt ?? null,
    p_content_hash: posting.contentHash,
    p_verification_state: posting.verificationState,
    p_domain_fit: score.components.domain,
    p_skill_fit: score.components.skill,
    p_evidence_fit: score.components.evidence,
    p_location_fit: score.components.location,
    p_eligibility_freshness: score.components.eligibilityFreshness,
    p_explanation_inputs: score.explanationInputs,
    ...(alert === undefined ? {} : {
      p_source_run_id: alert.sourceRunId,
      p_alert_recipient: alert.recipient,
    }),
  });
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) throw new PersistenceError("upsert_discovered_job");
  return { jobId: row.job_id, sourceNew: row.source_new, contentChanged: row.content_changed };
}

export function reconcileSecondarySource(
  client: PollerRpcClient,
  source: SourceDefinition,
  seenExternalJobIds: readonly string[],
): Promise<number> {
  return callRpc(client, "reconcile_secondary_source", {
    p_owner_id: source.ownerId,
    p_source_endpoint_id: source.id,
    p_seen_external_job_ids: seenExternalJobIds,
  });
}

export function recordSourceResult(
  client: PollerRpcClient,
  sourceRunId: number,
  sourceEndpointId: number,
  succeeded: boolean,
  discoveredCount: number,
  changedCount: number,
  sanitizedError: string | null,
): Promise<"healthy" | "degraded" | "failing" | "disabled"> {
  return callRpc(client, "record_source_result", {
    p_source_run_id: sourceRunId,
    p_source_endpoint_id: sourceEndpointId,
    p_succeeded: succeeded,
    p_discovered_count: discoveredCount,
    p_changed_count: changedCount,
    p_sanitized_error: sanitizedError,
  });
}

export function finishSourceRun(
  client: PollerRpcClient,
  sourceRunId: number,
): Promise<"succeeded" | "partial" | "failed"> {
  return callRpc(client, "finish_source_run", { p_source_run_id: sourceRunId });
}
