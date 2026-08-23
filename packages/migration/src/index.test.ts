import { describe, expect, it } from "vitest";
import { buildMigrationPlan, mergePublicSourceRegistry } from "./index.js";

const valid = {
  exportedAt: "2026-08-22T12:00:00Z",
  profileAndCriteria: { targetingCriteria: { role: "intern" }, contactPreferences: {}, alertSettings: {}, nonContactPreferences: {} },
  profileEvidence: [{ evidenceType: "project", label: "Verified project", fact: "Built a test fixture", sourceReference: "fixture:project", verifiedAt: "2026-08-01T12:00:00Z" }],
  searchSources: [{ company: "Example Robotics", tier: "A", priority: 90, active: true, careerUrl: "https://example.invalid/careers", ats: "greenhouse", boardIdentifier: "example", endpointUrl: "https://boards-api.greenhouse.io/v1/boards/example/jobs", intervalSeconds: 300, verifiedAt: "2026-08-20T12:00:00Z" }],
  jobs: [{ title: "Robotics Intern", company: "Example Robotics", url: "https://example.invalid/jobs/1?utm_source=test#details", location: "Toronto", status: "Applied", score: 85, discoveredAt: "2026-08-20T12:00:00Z", submittedAt: "2026-08-21T12:00:00Z", manualSubmissionConfirmedAt: "2026-08-21T12:00:00Z", userTracking: { note: "sanitized" } }],
  runLog: [{ startedAt: "2026-08-20T12:00:00Z", finishedAt: "2026-08-20T12:00:10Z", attemptedCount: 1, succeededCount: 1, failedCount: 0, discoveredCount: 1, changedCount: 0, outcome: "succeeded", partitionKey: "0" }],
};

describe("tracker migration plan", () => {
  it("normalizes a complete export and reconciles every row", () => {
    const plan = buildMigrationPlan(valid);
    expect(plan.reconciliation.reconciledExactly).toBe(true);
    expect(plan.reconciliation.rejections).toEqual([]);
    expect(plan.reconciliation.sheets["Profile & Criteria"]).toMatchObject({ sourceRows: 2, acceptedRows: 2, duplicateRows: 0 });
    expect(plan.jobs[0]).toMatchObject({ url: "https://example.invalid/jobs/1", jobState: "verified", applicationState: "submitted" });
    expect(plan.runs[0]?.workflowRunId).toMatch(/^tracker:[a-f0-9]{24}$/);
    expect(plan.runs[0]?.durationMs).toBe(10_000);
  });

  it("accounts for duplicates and rejects without silently losing rows", () => {
    const input = structuredClone(valid);
    input.jobs.push(structuredClone(input.jobs[0]!));
    input.jobs.push({ ...structuredClone(input.jobs[0]!), url: "http://unsafe.invalid/job", status: "mystery" });
    const plan = buildMigrationPlan(input);
    expect(plan.reconciliation.sheets.Jobs).toMatchObject({ sourceRows: 3, acceptedRows: 1, duplicateRows: 1, rejectedRows: 1, accountedExactly: true });
    expect(plan.reconciliation.rejections[0]).toMatchObject({ sheet: "Jobs", row: 4 });
  });

  it("rejects unsupported statuses even when the rest of the row is valid", () => {
    const input = structuredClone(valid);
    input.jobs[0]!.status = "Maybe someday";
    const plan = buildMigrationPlan(input);
    expect(plan.jobs).toHaveLength(0);
    expect(plan.reconciliation.rejections[0]?.reasons[0]).toContain("unsupported value");
  });

  it("rejects inactive sources without an auditable reason", () => {
    const input = structuredClone(valid);
    input.searchSources[0]!.active = false;
    const plan = buildMigrationPlan(input);
    expect(plan.sources).toHaveLength(0);
    expect(plan.reconciliation.rejections[0]?.reasons).toContain("disabledReason: is required for an inactive source");
  });

  it("deduplicates identical evidence while accounting for the source row", () => {
    const input = structuredClone(valid);
    input.profileEvidence.push(structuredClone(input.profileEvidence[0]!));
    const plan = buildMigrationPlan(input);
    expect(plan.evidence).toHaveLength(1);
    expect(plan.reconciliation.sheets["Profile & Criteria"]).toMatchObject({ sourceRows: 3, acceptedRows: 2, duplicateRows: 1, accountedExactly: true });
  });

  it("refuses to invent confirmation for historical submitted applications", () => {
    const input = structuredClone(valid) as unknown as { jobs: Array<Record<string, unknown>> };
    delete input.jobs[0]!.manualSubmissionConfirmedAt;
    const plan = buildMigrationPlan(input);
    expect(plan.jobs).toHaveLength(0);
    expect(plan.reconciliation.rejections[0]?.reasons.join(" ")).toContain("historical submitted application");
  });

  it("merges a verified public registry and strips verification-only counts", () => {
    const merged = mergePublicSourceRegistry(valid, {
      verifiedAt: "2026-08-22T12:00:00Z",
      method: "Sanitized verification fixture",
      sources: [{ ...valid.searchSources[0], boardIdentifier: "second", company: "Second Robotics", jobsAtVerification: 3 }],
    });
    const plan = buildMigrationPlan(merged);
    expect(plan.sources).toHaveLength(2);
    expect(plan.sources[1]).not.toHaveProperty("jobsAtVerification");
  });
});
