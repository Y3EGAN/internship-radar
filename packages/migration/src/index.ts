import { createHash } from "node:crypto";
import { z } from "zod";

const httpsUrl = z.string().url().refine((value) => value.startsWith("https://"), "must use HTTPS");
const timestamp = z.string().datetime({ offset: true });
const object = z.record(z.string(), z.unknown());
const atsSchema = z.enum(["greenhouse", "lever", "ashby", "workday", "smartrecruiters", "hosted_json", "simplify", "secondary", "career_page"]);

const profileSchema = z.object({
  targetingCriteria: object.default({}),
  contactPreferences: object.default({}),
  alertSettings: object.default({}),
  nonContactPreferences: object.default({}),
}).strict();

const evidenceSchema = z.object({
  evidenceType: z.string().trim().min(1),
  label: z.string().trim().min(1),
  fact: z.string().trim().min(1),
  sourceReference: z.string().trim().min(1),
  verifiedAt: timestamp,
  expiresAt: timestamp.optional(),
}).strict().superRefine((value, context) => {
  if (value.expiresAt && value.expiresAt <= value.verifiedAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "must be after verifiedAt" });
  }
});

const sourceSchema = z.object({
  company: z.string().trim().min(1),
  tier: z.enum(["A", "B", "C"]),
  priority: z.number().int().min(0).max(100).default(0),
  active: z.boolean().default(true),
  careerUrl: httpsUrl,
  ats: atsSchema,
  boardIdentifier: z.string().trim().min(1),
  endpointUrl: httpsUrl,
  renderMode: z.enum(["http", "browser"]).default("http"),
  intervalSeconds: z.number().int().min(300).max(86400),
  verifiedAt: timestamp.optional(),
  disabledReason: z.string().trim().min(1).optional(),
}).strict().superRefine((value, context) => {
  if (!value.active && !value.disabledReason) {
    context.addIssue({ code: "custom", path: ["disabledReason"], message: "is required for an inactive source" });
  }
});

const jobSchema = z.object({
  title: z.string().trim().min(1),
  company: z.string().trim().min(1).optional(),
  url: httpsUrl,
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.string().trim().min(1).default("discovered"),
  score: z.number().min(0).max(100).default(0),
  postedAt: timestamp.optional(),
  closesAt: timestamp.optional(),
  discoveredAt: timestamp,
  lastSeenAt: timestamp.optional(),
  submittedAt: timestamp.optional(),
  manualSubmissionConfirmedAt: timestamp.optional(),
  userTracking: object.default({}),
}).strict().superRefine((value, context) => {
  if (value.closesAt && value.postedAt && value.closesAt < value.postedAt) {
    context.addIssue({ code: "custom", path: ["closesAt"], message: "must not precede postedAt" });
  }
  if (value.lastSeenAt && value.lastSeenAt < value.discoveredAt) {
    context.addIssue({ code: "custom", path: ["lastSeenAt"], message: "must not precede discoveredAt" });
  }
  if (Boolean(value.submittedAt) !== Boolean(value.manualSubmissionConfirmedAt)) {
    context.addIssue({ code: "custom", path: ["submittedAt"], message: "and manualSubmissionConfirmedAt must be provided together" });
  }
  if (["applied", "submitted", "interviewing", "rejected", "offer"].includes(value.status.toLowerCase()) && (!value.submittedAt || !value.manualSubmissionConfirmedAt)) {
    context.addIssue({ code: "custom", path: ["manualSubmissionConfirmedAt"], message: "is required for a historical submitted application" });
  }
});

const runSchema = z.object({
  startedAt: timestamp,
  finishedAt: timestamp,
  attemptedCount: z.number().int().min(0),
  succeededCount: z.number().int().min(0),
  failedCount: z.number().int().min(0),
  discoveredCount: z.number().int().min(0),
  changedCount: z.number().int().min(0),
  outcome: z.enum(["succeeded", "partial", "failed", "skipped"]),
  partitionKey: z.string().trim().min(1).default("tracker-import"),
}).strict().superRefine((value, context) => {
  if (value.finishedAt < value.startedAt) context.addIssue({ code: "custom", path: ["finishedAt"], message: "must not precede startedAt" });
  if (value.succeededCount + value.failedCount > value.attemptedCount) context.addIssue({ code: "custom", path: ["attemptedCount"], message: "must cover succeeded and failed counts" });
});

export const trackerExportSchema = z.object({
  exportedAt: timestamp,
  profileAndCriteria: profileSchema,
  profileEvidence: z.array(evidenceSchema).default([]),
  searchSources: z.array(z.unknown()),
  jobs: z.array(z.unknown()),
  runLog: z.array(z.unknown()),
}).strict();

export const publicSourceRegistrySchema = z.object({
  verifiedAt: timestamp,
  method: z.string().trim().min(1),
  sources: z.array(sourceSchema.extend({ jobsAtVerification: z.number().int().positive() })),
  disabledSources: z.array(z.object({
    company: z.string().trim().min(1), ats: atsSchema,
    boardIdentifier: z.string().trim().min(1), careerUrl: httpsUrl, endpointUrl: httpsUrl,
    renderMode: z.enum(["http", "browser"]).default("http"),
    lastCheckedAt: timestamp, disabledReason: z.string().trim().min(1),
  }).strict()).default([]),
}).strict();

export type TrackerExport = z.infer<typeof trackerExportSchema>;

type SheetName = "Profile & Criteria" | "Search Sources" | "Jobs" | "Run Log";
export type Rejection = { sheet: Exclude<SheetName, "Profile & Criteria">; row: number; reasons: string[] };
type SheetReport = { sourceRows: number; acceptedRows: number; duplicateRows: number; rejectedRows: number; destinationRows: number; accountedExactly: boolean };

export type MigrationPlan = {
  exportedAt: string;
  profile: z.infer<typeof profileSchema>;
  evidence: z.infer<typeof evidenceSchema>[];
  sources: z.infer<typeof sourceSchema>[];
  jobs: Array<z.infer<typeof jobSchema> & { jobState: JobState; applicationState?: ApplicationState }>;
  runs: Array<z.infer<typeof runSchema> & { workflowRunId: string; durationMs: number }>;
  reconciliation: {
    sheets: Record<SheetName, SheetReport>;
    transformations: Record<string, number>;
    rejections: Rejection[];
    countsOnly: true;
    reconciledExactly: boolean;
  };
};

type JobState = "discovered" | "needs_verification" | "verified" | "shortlisted" | "dismissed" | "closed";
type ApplicationState = "not_started" | "submitted" | "interviewing" | "rejected" | "withdrawn" | "offer";

const statusMap: Record<string, { job: JobState; application?: ApplicationState }> = {
  discovered: { job: "discovered" },
  new: { job: "discovered" },
  "needs verification": { job: "needs_verification" },
  verified: { job: "verified" },
  shortlisted: { job: "shortlisted" },
  saved: { job: "shortlisted" },
  dismissed: { job: "dismissed" },
  skipped: { job: "dismissed" },
  closed: { job: "closed" },
  expired: { job: "closed" },
  applied: { job: "verified", application: "submitted" },
  submitted: { job: "verified", application: "submitted" },
  interviewing: { job: "verified", application: "interviewing" },
  rejected: { job: "verified", application: "rejected" },
  withdrawn: { job: "verified", application: "withdrawn" },
  offer: { job: "verified", application: "offer" },
};

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || ["source", "ref", "referrer"].includes(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function issues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`);
}

function sheetReport(sourceRows: number, acceptedRows: number, duplicateRows: number, rejectedRows: number): SheetReport {
  return { sourceRows, acceptedRows, duplicateRows, rejectedRows, destinationRows: acceptedRows, accountedExactly: sourceRows === acceptedRows + duplicateRows + rejectedRows };
}

export function buildMigrationPlan(input: unknown): MigrationPlan {
  const parsed = trackerExportSchema.parse(input);
  const rejections: Rejection[] = [];
  const sources: MigrationPlan["sources"] = [];
  const evidence: MigrationPlan["evidence"] = [];
  const jobs: MigrationPlan["jobs"] = [];
  const runs: MigrationPlan["runs"] = [];
  const sourceKeys = new Set<string>();
  const jobKeys = new Set<string>();
  const runKeys = new Set<string>();
  let evidenceDuplicates = 0, sourceDuplicates = 0, jobDuplicates = 0, runDuplicates = 0, canonicalizedUrls = 0, mappedStatuses = 0;

  const evidenceKeys = new Set<string>();
  for (const item of parsed.profileEvidence) {
    const key = `${item.sourceReference}\u0000${item.fact}`;
    if (evidenceKeys.has(key)) { evidenceDuplicates += 1; continue; }
    evidenceKeys.add(key); evidence.push(item);
  }

  parsed.searchSources.forEach((raw, index) => {
    const result = sourceSchema.safeParse(raw);
    if (!result.success) { rejections.push({ sheet: "Search Sources", row: index + 2, reasons: issues(result.error) }); return; }
    const key = `${result.data.ats}:${result.data.boardIdentifier.toLowerCase()}`;
    if (sourceKeys.has(key)) { sourceDuplicates += 1; return; }
    sourceKeys.add(key); sources.push(result.data);
  });

  parsed.jobs.forEach((raw, index) => {
    const result = jobSchema.safeParse(raw);
    if (!result.success) { rejections.push({ sheet: "Jobs", row: index + 2, reasons: issues(result.error) }); return; }
    const normalizedUrl = canonicalUrl(result.data.url);
    if (normalizedUrl !== result.data.url) canonicalizedUrls += 1;
    if (jobKeys.has(normalizedUrl)) { jobDuplicates += 1; return; }
    const mapped = statusMap[result.data.status.toLowerCase()];
    if (!mapped) { rejections.push({ sheet: "Jobs", row: index + 2, reasons: [`status: unsupported value ${JSON.stringify(result.data.status)}`] }); return; }
    jobKeys.add(normalizedUrl); mappedStatuses += 1;
    jobs.push({ ...result.data, url: normalizedUrl, jobState: mapped.job, ...(mapped.application ? { applicationState: mapped.application } : {}) });
  });

  parsed.runLog.forEach((raw, index) => {
    const result = runSchema.safeParse(raw);
    if (!result.success) { rejections.push({ sheet: "Run Log", row: index + 2, reasons: issues(result.error) }); return; }
    const key = `${result.data.startedAt}:${result.data.partitionKey}`;
    if (runKeys.has(key)) { runDuplicates += 1; return; }
    runKeys.add(key);
    const workflowRunId = `tracker:${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
    runs.push({ ...result.data, workflowRunId, durationMs: new Date(result.data.finishedAt).getTime() - new Date(result.data.startedAt).getTime() });
  });

  const sheets = {
    "Profile & Criteria": sheetReport(1 + parsed.profileEvidence.length, 1 + evidence.length, evidenceDuplicates, 0),
    "Search Sources": sheetReport(parsed.searchSources.length, sources.length, sourceDuplicates, rejections.filter((x) => x.sheet === "Search Sources").length),
    Jobs: sheetReport(parsed.jobs.length, jobs.length, jobDuplicates, rejections.filter((x) => x.sheet === "Jobs").length),
    "Run Log": sheetReport(parsed.runLog.length, runs.length, runDuplicates, rejections.filter((x) => x.sheet === "Run Log").length),
  };
  return {
    exportedAt: parsed.exportedAt,
    profile: parsed.profileAndCriteria,
    evidence,
    sources, jobs, runs,
    reconciliation: {
      sheets,
      transformations: { canonicalizedUrls, mappedStatuses },
      rejections, countsOnly: true,
      reconciledExactly: Object.values(sheets).every((sheet) => sheet.accountedExactly),
    },
  };
}

export function mergePublicSourceRegistry(input: unknown, registryInput: unknown): unknown {
  const tracker = trackerExportSchema.parse(input);
  const registry = publicSourceRegistrySchema.parse(registryInput);
  return {
    ...tracker,
    searchSources: [
      ...tracker.searchSources,
      ...registry.sources.map((source) => ({
        company: source.company, tier: source.tier, priority: source.priority, active: source.active,
        careerUrl: source.careerUrl, ats: source.ats, boardIdentifier: source.boardIdentifier,
        endpointUrl: source.endpointUrl, intervalSeconds: source.intervalSeconds, verifiedAt: source.verifiedAt,
        renderMode: source.renderMode,
      })),
    ],
  };
}

export function countsOnlyReport(plan: MigrationPlan): MigrationPlan["reconciliation"] {
  return plan.reconciliation;
}
