import { fixtureSources, greenhousePayload } from "@internship-radar/test-fixtures";
import { describe, expect, it, vi } from "vitest";
import type { PollerRpcClient } from "./repository";
import {
  partitionSources,
  runSchedulerCycle,
  runWithPerDomainConcurrency,
  schedulerIsStale,
  sourcePartition,
} from "./scheduler";

const scoringProfile = {
  domainKeywords: ["robot"],
  skillKeywords: ["c++"],
  evidenceKeywords: ["controls"],
  preferredLocations: ["Toronto"],
  remoteEligible: false,
  disqualifyingKeywords: ["senior"],
} as const;

class FixtureRpcClient implements PollerRpcClient {
  readonly jobs = new Map<string, number>();
  readonly runs = new Map<number, { succeeded: number; failed: number }>();
  private nextRun = 1;

  async rpc(functionName: string, args: Readonly<Record<string, unknown>>) {
    if (functionName === "try_start_source_run") {
      const id = this.nextRun++;
      this.runs.set(id, { succeeded: 0, failed: 0 });
      return { data: id, error: null };
    }
    if (functionName === "upsert_discovered_job") {
      const key = `${String(args.p_source_endpoint_id)}:${String(args.p_external_job_id)}`;
      const existing = this.jobs.get(key);
      const id = existing ?? this.jobs.size + 1;
      this.jobs.set(key, id);
      return { data: [{ job_id: id, source_new: existing === undefined, content_changed: false }], error: null };
    }
    if (functionName === "record_source_result") {
      const run = this.runs.get(Number(args.p_source_run_id))!;
      if (args.p_succeeded === true) run.succeeded += 1;
      else run.failed += 1;
      return { data: args.p_succeeded === true ? "healthy" : "degraded", error: null };
    }
    if (functionName === "finish_source_run") {
      const run = this.runs.get(Number(args.p_source_run_id))!;
      const outcome = run.failed === 0 ? "succeeded" : run.succeeded === 0 ? "failed" : "partial";
      return { data: outcome, error: null };
    }
    return { data: null, error: { code: "42883" } };
  }
}

describe("scheduler orchestration", () => {
  it("assigns sources to stable endpoint-hash partitions", () => {
    const first = sourcePartition(fixtureSources.greenhouse, 8);
    expect(sourcePartition(fixtureSources.greenhouse, 8)).toBe(first);
    expect(partitionSources(Object.values(fixtureSources), 8).flat()).toHaveLength(7);
  });

  it("enforces concurrency independently per source domain", async () => {
    const sameDomain = [
      fixtureSources.greenhouse,
      { ...fixtureSources.greenhouse, id: 20, boardIdentifier: "fixture-two" },
      { ...fixtureSources.greenhouse, id: 21, boardIdentifier: "fixture-three" },
    ];
    let active = 0;
    let maximum = 0;
    await runWithPerDomainConcurrency(sameDomain, 2, async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    });
    expect(maximum).toBe(2);
  });

  it("completes three partial fixture cycles without duplicating healthy postings", async () => {
    const client = new FixtureRpcClient();
    const fetchImpl = vi.fn((input: string | URL | Request) => Promise.resolve(
      String(input).includes("greenhouse")
        ? Response.json(greenhousePayload)
        : new Response("{}", { status: 503 }),
    ));

    for (let cycle = 1; cycle <= 3; cycle += 1) {
      const result = await runSchedulerCycle({
        client,
        ownerId: fixtureSources.greenhouse.ownerId,
        workflowRunId: `fixture-cycle-${cycle}`,
        sources: [fixtureSources.greenhouse, fixtureSources.lever],
        scoringProfile,
        fetchImpl,
        maxAttempts: 1,
        partitionCount: 2,
      });
      expect(result).toMatchObject({ status: "partial", attempted: 2, succeeded: 1, failed: 1 });
    }

    expect(client.runs.size).toBe(3);
    expect(client.jobs.size).toBe(1);
  });

  it("does not persist non-internship jobs from broad employer boards", async () => {
    const client = new FixtureRpcClient();
    const payload = {
      jobs: [
        greenhousePayload.jobs[0],
        { ...greenhousePayload.jobs[0], id: 102, title: "Senior Software Engineer", absolute_url: "https://boards.greenhouse.io/example-robotics/jobs/102" },
        { ...greenhousePayload.jobs[0], id: 103, title: "Internal Tools Engineer", absolute_url: "https://boards.greenhouse.io/example-robotics/jobs/103" },
      ],
    };
    const result = await runSchedulerCycle({
      client,
      ownerId: fixtureSources.greenhouse.ownerId,
      workflowRunId: "internship-filter",
      sources: [fixtureSources.greenhouse],
      scoringProfile,
      fetchImpl: vi.fn(() => Promise.resolve(Response.json(payload))),
      maxAttempts: 1,
      partitionCount: 1,
    });
    expect(result).toMatchObject({ status: "succeeded", discovered: 1 });
    expect(client.jobs.size).toBe(1);
  });

  it("skips work when the database overlap claim is unavailable", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const fetchImpl = vi.fn();
    const result = await runSchedulerCycle({
      client: { rpc },
      ownerId: fixtureSources.greenhouse.ownerId,
      workflowRunId: "overlap",
      sources: [fixtureSources.greenhouse],
      scoringProfile,
      fetchImpl,
    });
    expect(result.status).toBe("skipped");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("warns after twenty minutes without a successful run", () => {
    const now = new Date("2026-08-22T20:30:00Z");
    expect(schedulerIsStale(new Date("2026-08-22T20:10:00Z"), now)).toBe(false);
    expect(schedulerIsStale(new Date("2026-08-22T20:09:59Z"), now)).toBe(true);
    expect(schedulerIsStale(null, now)).toBe(true);
  });
});
