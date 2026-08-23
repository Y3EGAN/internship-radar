import { z } from "zod";

export const atsTypeSchema = z.enum([
  "greenhouse",
  "lever",
  "ashby",
  "workday",
  "smartrecruiters",
  "hosted_json",
  "simplify",
  "secondary",
]);

export const discoveredPostingSchema = z.object({
  ats: atsTypeSchema,
  externalJobId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  normalizedTitle: z.string().trim().min(1),
  canonicalUrl: z.string().url().startsWith("https://"),
  sourceUrl: z.string().url().startsWith("https://"),
  description: z.string(),
  location: z.string(),
  normalizedLocation: z.string(),
  department: z.string().optional(),
  employmentType: z.string().optional(),
  postedAt: z.string().datetime({ offset: true }).optional(),
  closesAt: z.string().datetime({ offset: true }).optional(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  verificationState: z.enum(["needs_verification", "verified"]),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
});

export type AtsType = z.infer<typeof atsTypeSchema>;
export type DiscoveredPosting = z.infer<typeof discoveredPostingSchema>;

export const sourceDefinitionSchema = z.object({
  id: z.number().int().positive(),
  ownerId: z.string().uuid(),
  ats: atsTypeSchema,
  boardIdentifier: z.string().trim().min(1),
  endpointUrl: z.string().url().startsWith("https://"),
  companyName: z.string().trim().min(1),
});

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;

const internshipTerm = /\b(?:intern(?:ship)?|co[\s-]?op|working student|student placement)\b/iu;

export function isTargetInternship(posting: Pick<DiscoveredPosting, "title" | "employmentType">): boolean {
  return internshipTerm.test(`${posting.title} ${posting.employmentType ?? ""}`);
}
