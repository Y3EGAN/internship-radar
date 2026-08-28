type CompanyRecord = { readonly name: string | null };

export type EmbeddedCompany = CompanyRecord | readonly CompanyRecord[] | null | undefined;

export const COMPANY_FALLBACK = "Company not listed";

function isCompanyList(value: CompanyRecord | readonly CompanyRecord[]): value is readonly CompanyRecord[] {
  return Array.isArray(value);
}

/** PostgREST returns an embedded one-to-one relation as an object or a single-element array. */
export function resolveCompanyName(value: EmbeddedCompany): string | null {
  if (value === null || value === undefined) return null;
  const record = isCompanyList(value) ? value[0] : value;
  const name = record?.name?.trim();
  return name === undefined || name === "" ? null : name;
}

export function formatCompanyName(value: EmbeddedCompany): string {
  return resolveCompanyName(value) ?? COMPANY_FALLBACK;
}

export function formatDate(value: string | null, fallback = "Not listed"): string {
  if (value === null) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return fallback;
  return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Toronto" }).format(date);
}

export interface SaveJobInput {
  readonly jobId: number;
  readonly saved: boolean;
}

export interface AppliedJobInput {
  readonly jobId: number;
  readonly applied: boolean;
}

/**
 * Server actions are public endpoints, so the toggle payload is validated as untrusted input
 * before it reaches the database.
 */
export function parseSaveJobInput(jobId: unknown, saved: unknown): SaveJobInput | null {
  const input = parseJobToggleInput(jobId, saved);
  return input === null ? null : { jobId: input.jobId, saved: input.enabled };
}

export function parseAppliedJobInput(jobId: unknown, applied: unknown): AppliedJobInput | null {
  const input = parseJobToggleInput(jobId, applied);
  return input === null ? null : { jobId: input.jobId, applied: input.enabled };
}

function parseJobToggleInput(jobId: unknown, enabled: unknown): { jobId: number; enabled: boolean } | null {
  if (typeof jobId !== "string" || typeof enabled !== "string") return null;
  if (!/^[1-9][0-9]{0,15}$/.test(jobId)) return null;
  if (enabled !== "true" && enabled !== "false") return null;
  const parsed = Number(jobId);
  if (!Number.isSafeInteger(parsed)) return null;
  return { jobId: parsed, enabled: enabled === "true" };
}
