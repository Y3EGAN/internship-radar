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
  "career_page",
]);

export const discoveredPostingSchema = z.object({
  ats: atsTypeSchema,
  externalJobId: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
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
  renderMode: z.enum(["http", "browser"]).default("http"),
});

export type SourceDefinition = z.infer<typeof sourceDefinitionSchema>;

const internshipTerm = /\b(?:intern(?:ship)?|co[\s-]?op|working student|student placement)\b/iu;

export function isTargetInternship(posting: Pick<DiscoveredPosting, "title" | "employmentType">): boolean {
  return internshipTerm.test(`${posting.title} ${posting.employmentType ?? ""}`);
}

const canadianLocation = /\b(?:canada|canadian|alberta|british columbia|manitoba|new brunswick|newfoundland(?: and labrador)?|nova scotia|ontario|prince edward island|quebec|saskatchewan|northwest territories|nunavut|yukon|ab|bc|mb|nb|nl|ns|nt|nu|on|pe|qc|sk|yt)\b/iu;
const unitedStatesLocation = /\b(?:united states(?: of america)?|u\.?s\.?a?|alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia|washington,? dc|al|ak|az|ar|ca|co|ct|de|fl|ga|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|oh|ok|or|pa|ri|sc|sd|tn|tx|ut|vt|va|wa|wv|wi|wy|dc)\b/iu;
const explicitlyRemote = /\bremote\b/iu;
const northAmerica = /\bnorth america(?:n)?\b/iu;

export function isCanadaOrUnitedStatesLocation(location: string): boolean {
  const normalized = location.replace(/[./_-]+/gu, " ");
  const namedCountry = canadianLocation.test(normalized) || unitedStatesLocation.test(normalized);
  if (!explicitlyRemote.test(normalized)) return namedCountry;
  return namedCountry || northAmerica.test(normalized);
}
