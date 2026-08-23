import {
  canonicalizeUrl,
  discoveredPostingSchema,
  normalizeLocation,
  normalizeTitle,
  stableContentHash,
  stripHtml,
  type AtsType,
  type DiscoveredPosting,
} from "@internship-radar/core";

export function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

export function list(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

export function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

export function optionalDate(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date.toISOString();
}

export interface PostingInput {
  readonly ats: AtsType;
  readonly externalJobId: string;
  readonly title: string;
  readonly canonicalUrl: string;
  readonly sourceUrl?: string | undefined;
  readonly description?: string | undefined;
  readonly descriptionIsHtml?: boolean | undefined;
  readonly location?: string | undefined;
  readonly department?: string | undefined;
  readonly employmentType?: string | undefined;
  readonly postedAt?: string | undefined;
  readonly closesAt?: string | undefined;
  readonly verificationState?: "needs_verification" | "verified" | undefined;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>> | undefined;
}

export function posting(input: PostingInput): DiscoveredPosting {
  const description = input.descriptionIsHtml ? stripHtml(input.description ?? "") : (input.description ?? "").trim();
  const canonicalUrl = canonicalizeUrl(input.canonicalUrl);
  const normalized = {
    ats: input.ats,
    externalJobId: input.externalJobId,
    title: input.title.trim(),
    normalizedTitle: normalizeTitle(input.title),
    canonicalUrl,
    sourceUrl: canonicalizeUrl(input.sourceUrl ?? canonicalUrl),
    description,
    location: input.location?.trim() ?? "",
    normalizedLocation: normalizeLocation(input.location ?? ""),
    ...(input.department === undefined ? {} : { department: input.department }),
    ...(input.employmentType === undefined ? {} : { employmentType: input.employmentType }),
    ...(input.postedAt === undefined ? {} : { postedAt: input.postedAt }),
    ...(input.closesAt === undefined ? {} : { closesAt: input.closesAt }),
    verificationState: input.verificationState ?? "verified",
    metadata: input.metadata ?? {},
  };

  return discoveredPostingSchema.parse({
    ...normalized,
    contentHash: stableContentHash(normalized),
  });
}
