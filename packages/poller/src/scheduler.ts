import { createHash } from "node:crypto";
import type { ScoringProfile, SourceDefinition } from "@internship-radar/core";
import { isCanadaOrUnitedStatesLocation, isTargetInternship, scorePosting } from "@internship-radar/core";
import { adapterRegistry } from "./adapters";
import type { RequestJsonOptions } from "./http";
import { runSource } from "./pipeline";
import { LinkVerificationCoordinator } from "./link-verification";
import type { LinkVerificationStore } from "./postgrest";
import type { AdapterRunResult } from "./types";
import {
  finishSourceRun,
  persistPosting,
  reconcileSecondarySource,
  recordSourceResult,
  tryStartSourceRun,
  type PollerRpcClient,
} from "./repository";

export const INTERNAL_DISCOVERY_DEADLINE_MS = 180_000;
export const DEFAULT_PARTITION_COUNT = 8;
export const DEFAULT_PER_DOMAIN_CONCURRENCY = 2;
export const SCHEDULER_STALE_AFTER_MS = 20 * 60_000;

export function schedulerIsStale(lastSuccessfulRunAt: Date | null, now = new Date()): boolean {
  return lastSuccessfulRunAt === null
    || now.valueOf() - lastSuccessfulRunAt.valueOf() > SCHEDULER_STALE_AFTER_MS;
}

export interface SchedulerCycleOptions extends RequestJsonOptions {
  readonly client: PollerRpcClient & Partial<LinkVerificationStore>;
  readonly ownerId: string;
  readonly workflowRunId: string;
  readonly sources: readonly SourceDefinition[];
  readonly scoringProfile: ScoringProfile;
  readonly alertRecipient?: string;
  readonly partitionCount?: number;
  readonly perDomainConcurrency?: number;
  readonly deadlineMs?: number;
  readonly now?: () => number;
}

export interface SchedulerCycleResult {
  readonly status: "succeeded" | "partial" | "failed" | "skipped";
  readonly runId: number | null;
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly discovered: number;
  readonly changed: number;
}

export function sourcePartition(source: SourceDefinition, partitionCount = DEFAULT_PARTITION_COUNT): number {
  if (!Number.isInteger(partitionCount) || partitionCount < 1) throw new RangeError("partition count must be a positive integer");
  const digest = createHash("sha256").update(`${source.ats}\0${source.id}\0${source.endpointUrl}`).digest();
  return digest.readUInt32BE(0) % partitionCount;
}

export function partitionSources(
  sources: readonly SourceDefinition[],
  partitionCount = DEFAULT_PARTITION_COUNT,
): readonly (readonly SourceDefinition[])[] {
  const partitions = Array.from({ length: partitionCount }, () => [] as SourceDefinition[]);
  for (const source of sources) partitions[sourcePartition(source, partitionCount)]!.push(source);
  for (const partition of partitions) partition.sort((left, right) => left.endpointUrl.localeCompare(right.endpointUrl));
  return partitions;
}

function sourceDomain(source: SourceDefinition): string {
  return new URL(source.endpointUrl).hostname.toLowerCase();
}

export async function runWithPerDomainConcurrency<T>(
  sources: readonly SourceDefinition[],
  limit: number,
  worker: (source: SourceDefinition) => Promise<T>,
): Promise<readonly T[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError("per-domain concurrency must be a positive integer");
  const active = new Map<string, number>();
  const waiters = new Map<string, Array<() => void>>();

  async function acquire(domain: string): Promise<() => void> {
    if ((active.get(domain) ?? 0) >= limit) {
      await new Promise<void>((resolve) => {
        const queue = waiters.get(domain) ?? [];
        queue.push(resolve);
        waiters.set(domain, queue);
      });
    }
    active.set(domain, (active.get(domain) ?? 0) + 1);
    return () => {
      active.set(domain, (active.get(domain) ?? 1) - 1);
      waiters.get(domain)?.shift()?.();
    };
  }

  return Promise.all(sources.map(async (source) => {
    const release = await acquire(sourceDomain(source));
    try {
      return await worker(source);
    } finally {
      release();
    }
  }));
}

export async function runSchedulerCycle(options: SchedulerCycleOptions): Promise<SchedulerCycleResult> {
  const now = options.now ?? Date.now;
  const deadlineAt = now() + (options.deadlineMs ?? INTERNAL_DISCOVERY_DEADLINE_MS);
  const verificationStore = options.client.loadLinkVerifications !== undefined && options.client.saveLinkVerification !== undefined
    ? options.client as PollerRpcClient & LinkVerificationStore
    : null;
  const linkVerifier = verificationStore === null ? null : new LinkVerificationCoordinator(options.ownerId, verificationStore, {
    ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
    now,
    budget: 50,
  });
  const runId = await tryStartSourceRun(
    options.client,
    options.ownerId,
    options.workflowRunId,
    "all-partitions",
  );
  if (runId === null) {
    return { status: "skipped", runId: null, attempted: 0, succeeded: 0, failed: 0, discovered: 0, changed: 0 };
  }

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let discovered = 0;
  let changed = 0;
  const partitions = partitionSources(options.sources, options.partitionCount);
  const prepared: Array<{ readonly source: SourceDefinition; readonly result: AdapterRunResult }> = [];

  for (const partition of partitions) {
    await runWithPerDomainConcurrency(
      partition,
      options.perDomainConcurrency ?? DEFAULT_PER_DOMAIN_CONCURRENCY,
      async (source) => {
        attempted += 1;
        if (source.ownerId !== options.ownerId || now() >= deadlineAt) {
          failed += 1;
          await recordSourceResult(
            options.client, runId, source.id, false, 0, 0,
            source.ownerId !== options.ownerId ? "source owner did not match scheduler owner" : "internal discovery deadline exceeded",
          );
          return;
        }

        const adapter = adapterRegistry.get(source.ats);
        const result = adapter === undefined
          ? null
          : await runSource(source, adapter, {
              ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
              ...(options.renderFetchImpl === undefined ? {} : { renderFetchImpl: options.renderFetchImpl }),
              ...(options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs }),
              ...(options.maxAttempts === undefined ? {} : { maxAttempts: options.maxAttempts }),
              ...(options.sleep === undefined ? {} : { sleep: options.sleep }),
              ...(options.jitter === undefined ? {} : { jitter: options.jitter }),
            });
        if (result === null || result.status === "failed") {
          failed += 1;
          await recordSourceResult(
            options.client, runId, source.id, false, 0, 0,
            result?.issue?.message ?? "no adapter is registered for this source type",
          );
          return;
        }
        prepared.push({ source, result });
      },
    );
  }

  const candidatesBySource = new Map<number, Array<{
    posting: AdapterRunResult["postings"][number];
    score: ReturnType<typeof scorePosting>;
  }>>();
  for (const { source, result } of prepared) {
    const isSecondary = source.ats === "secondary" || source.ats === "simplify";
    candidatesBySource.set(source.id, result.postings
      .filter((posting) => isTargetInternship(posting) && (!isSecondary || isCanadaOrUnitedStatesLocation(posting.location)))
      .map((posting) => ({ posting, score: scorePosting(posting, options.scoringProfile, new Date(now())) })));
  }

  let verificationFailed = false;
  if (linkVerifier !== null) {
    const indexed = prepared.flatMap(({ source }) => source.ats === "secondary" || source.ats === "simplify"
      ? (candidatesBySource.get(source.id) ?? []).map((candidate, index) => ({ sourceId: source.id, index, candidate }))
      : []);
    try {
      const verified = await linkVerifier.verify(indexed.map(({ candidate }) => candidate));
      for (const [position, candidate] of verified.entries()) {
        const target = indexed[position];
        if (target !== undefined) candidatesBySource.get(target.sourceId)![target.index] = candidate;
      }
    } catch {
      verificationFailed = true;
    }
  }

  for (const { source, result } of prepared) {
    const candidates = candidatesBySource.get(source.id) ?? [];
    const isSecondary = source.ats === "secondary" || source.ats === "simplify";
    let sourceChanged = 0;
    try {
      for (const { posting, score } of candidates) {
        const persisted = await persistPosting(
          options.client,
          source,
          posting,
          score,
          options.alertRecipient === undefined ? undefined : { sourceRunId: runId, recipient: options.alertRecipient },
        );
        if (persisted.contentChanged) sourceChanged += 1;
      }
      if (isSecondary && result.status !== "partial") {
        await reconcileSecondarySource(options.client, source, candidates.map(({ posting }) => posting.externalJobId));
      }
      discovered += candidates.length;
      changed += sourceChanged;
      if (result.status === "partial" || (isSecondary && verificationFailed)) {
        failed += 1;
        await recordSourceResult(
          options.client, runId, source.id, false, candidates.length, sourceChanged,
          verificationFailed ? "link verification unavailable" : result.issue?.message ?? "source payload was partial",
        );
      } else {
        succeeded += 1;
        await recordSourceResult(options.client, runId, source.id, true, candidates.length, sourceChanged, null);
      }
    } catch {
      failed += 1;
      await recordSourceResult(options.client, runId, source.id, false, 0, 0, "source persistence failed");
    }
  }

  const status = await finishSourceRun(options.client, runId);
  return { status, runId, attempted, succeeded, failed, discovered, changed };
}
