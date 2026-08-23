import { describe, expect, it } from "vitest";
import { evaluatePreparation, type PreparationRequest } from "./index";

const base: PreparationRequest = {
  applicationState: "queued_for_codex",
  jobVerified: true,
  priorApplicationExists: false,
  evidence: [{ id: 7, fact: "Built a TypeScript telemetry dashboard that reduced triage time by 20%.", verifiedAt: "2026-08-01T00:00:00Z" }],
  claims: [{ text: "Built a TypeScript telemetry dashboard, reducing triage time by 20%.", evidenceIds: [7], materialTerms: ["TypeScript", "telemetry dashboard"] }],
  questions: [],
  coverLetterRequired: false,
  coverLetterRequested: false,
};

describe("truth-preserving application preparation", () => {
  it("accepts a supported claim and records its evidence", () => expect(evaluatePreparation(base)).toMatchObject({ state: "ready_to_render", coverLetter: false, evidenceManifest: [{ evidenceIds: [7] }] }));
  it("rejects an invented skill", () => expect(evaluatePreparation({ ...base, claims: [{ ...base.claims[0]!, materialTerms: ["Kubernetes"] }] })).toMatchObject({ state: "rejected", reasons: ["claim_contains_unsupported_material_term"] }));
  it("rejects an invented metric", () => expect(evaluatePreparation({ ...base, claims: [{ ...base.claims[0]!, text: "Reduced triage time by 45%." }] })).toMatchObject({ state: "rejected", reasons: ["claim_contains_unsupported_metric"] }));
  it("rejects unverified jobs and duplicate applications", () => expect(evaluatePreparation({ ...base, jobVerified: false, priorApplicationExists: true })).toMatchObject({ state: "rejected", reasons: ["job_not_verified", "prior_application_exists"] }));
  it("pauses for unknown required answers", () => expect(evaluatePreparation({ ...base, questions: [{ fingerprint: "unknown", text: "What is your salary expectation?", required: true, sensitivity: "contextual" }] })).toMatchObject({ state: "needs_input", questions: [{ fingerprint: "unknown" }] }));
  it("pauses for sensitive answers even when a reusable answer exists", () => expect(evaluatePreparation({ ...base, questions: [{ fingerprint: "authorization", text: "Will you need sponsorship?", required: true, sensitivity: "never_infer", approvedAnswer: "fixture" }] })).toMatchObject({ state: "needs_input" }));
  it("allows an explicitly confirmed contextual answer", () => expect(evaluatePreparation({ ...base, questions: [{ fingerprint: "context", text: "Preferred office?", required: true, sensitivity: "contextual", approvedAnswer: "Toronto", confirmedForApplication: true }] })).toMatchObject({ state: "ready_to_render" }));
  it("generates a cover letter only when required or requested", () => {
    expect(evaluatePreparation({ ...base, coverLetterRequired: true })).toMatchObject({ coverLetter: true });
    expect(evaluatePreparation({ ...base, coverLetterRequested: true })).toMatchObject({ coverLetter: true });
  });
});
