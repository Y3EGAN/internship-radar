export type Evidence = {
  id: number;
  fact: string;
  verifiedAt: string;
  expiresAt?: string | null;
};

export type PreparedClaim = {
  text: string;
  evidenceIds: number[];
  materialTerms: string[];
};

export type ScreeningQuestion = {
  fingerprint: string;
  text: string;
  required: boolean;
  sensitivity: "safe_reuse" | "contextual" | "never_infer";
  approvedAnswer?: string;
  confirmedForApplication?: boolean;
};

export type PreparationRequest = {
  applicationState: string;
  jobVerified: boolean;
  priorApplicationExists: boolean;
  evidence: Evidence[];
  claims: PreparedClaim[];
  questions: ScreeningQuestion[];
  coverLetterRequired: boolean;
  coverLetterRequested: boolean;
};

export type PreparationDecision =
  | { state: "ready_to_render"; coverLetter: boolean; evidenceManifest: Array<{ claim: string; evidenceIds: number[] }> }
  | { state: "needs_input"; questions: Array<{ fingerprint: string; prompt: string }> }
  | { state: "rejected"; reasons: string[] };

function normalized(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-CA");
}

export function evaluatePreparation(request: PreparationRequest, now = new Date()): PreparationDecision {
  const reasons: string[] = [];
  if (request.applicationState !== "queued_for_codex") reasons.push("application_not_explicitly_queued");
  if (!request.jobVerified) reasons.push("job_not_verified");
  if (request.priorApplicationExists) reasons.push("prior_application_exists");

  const evidenceById = new Map(request.evidence.map(item => [item.id, item]));
  for (const claim of request.claims) {
    if (claim.evidenceIds.length === 0) reasons.push("claim_missing_evidence");
    const facts = claim.evidenceIds.map(id => evidenceById.get(id)).filter((item): item is Evidence => Boolean(item));
    if (facts.length !== claim.evidenceIds.length) reasons.push("claim_references_unknown_evidence");
    if (facts.some(item => item.expiresAt && new Date(item.expiresAt) <= now)) reasons.push("claim_references_expired_evidence");
    const factText = normalized(facts.map(item => item.fact).join(" "));
    if (claim.materialTerms.some(term => !factText.includes(normalized(term)))) reasons.push("claim_contains_unsupported_material_term");
    const claimNumbers = claim.text.match(/\b\d+(?:\.\d+)?%?\b/g) ?? [];
    if (claimNumbers.some(number => !factText.includes(normalized(number)))) reasons.push("claim_contains_unsupported_metric");
  }
  if (reasons.length) return { state: "rejected", reasons: [...new Set(reasons)] };

  const unresolved = request.questions.filter(question => question.required && (
    !question.approvedAnswer
    || question.sensitivity === "never_infer" && !question.confirmedForApplication
    || question.sensitivity === "contextual" && !question.confirmedForApplication
  ));
  if (unresolved.length) return {
    state: "needs_input",
    questions: unresolved.map(question => ({ fingerprint: question.fingerprint, prompt: question.text })),
  };

  return {
    state: "ready_to_render",
    coverLetter: request.coverLetterRequired || request.coverLetterRequested,
    evidenceManifest: request.claims.map(claim => ({ claim: claim.text, evidenceIds: claim.evidenceIds })),
  };
}
