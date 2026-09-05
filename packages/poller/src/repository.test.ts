import { fixtureSources, greenhousePayload } from "@internship-radar/test-fixtures";
import { describe, expect, it, vi } from "vitest";
import { greenhouseAdapter } from "./adapters";
import { PersistenceError, finishSourceRun, persistPosting, startSourceRun } from "./repository";

describe("poller repository", () => {
  it("maps a normalized posting and deterministic score to the atomic upsert RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ job_id: 42, source_new: true, content_changed: false }],
      error: null,
    });
    const posting = greenhouseAdapter.parse(greenhousePayload, fixtureSources.greenhouse).postings[0]!;
    const result = await persistPosting({ rpc }, fixtureSources.greenhouse, posting, {
      components: { domain: 25, skill: 24, evidence: 16, location: 8, eligibilityFreshness: 9 },
      total: 82,
      explanationInputs: {
        domainMatches: ["robotics"], skillMatches: ["typescript"], evidenceMatches: [],
        locationMatched: true, disqualifyingMatches: [], freshnessDays: 1,
      },
    });

    expect(result).toEqual({ jobId: 42, sourceNew: true, contentChanged: false });
    expect(rpc).toHaveBeenCalledWith("upsert_discovered_job", expect.objectContaining({
      p_owner_id: fixtureSources.greenhouse.ownerId,
      p_source_endpoint_id: fixtureSources.greenhouse.id,
      p_external_job_id: posting.externalJobId,
      p_content_hash: posting.contentHash,
      p_domain_fit: 25,
      p_eligibility_freshness: 9,
    }));
  });

  it("uses idempotency coordinates when starting a source run", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 9, error: null });
    await expect(startSourceRun({ rpc }, fixtureSources.greenhouse.ownerId, "workflow-1", "partition-a"))
      .resolves.toBe(9);
    expect(rpc).toHaveBeenCalledWith("start_source_run", {
      p_owner_id: fixtureSources.greenhouse.ownerId,
      p_workflow_run_id: "workflow-1",
      p_partition_key: "partition-a",
    });
  });

  it("returns the persisted run outcome", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "partial", error: null });
    await expect(finishSourceRun({ rpc }, 11)).resolves.toBe("partial");
  });

  it("does not leak backend error details", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "23503", message: "secret row detail" } });
    const promise = startSourceRun({ rpc }, fixtureSources.greenhouse.ownerId, "workflow-2", "partition-b");
    await expect(promise).rejects.toEqual(expect.objectContaining({
      name: "PersistenceError", message: "database operation failed: start_source_run", code: "23503",
    }));
    await expect(promise).rejects.not.toThrow("secret row detail");
    expect(await promise.catch((error: unknown) => error)).toBeInstanceOf(PersistenceError);
  });
});
