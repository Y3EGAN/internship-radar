import { normalizeLocation, normalizeWhitespace } from "./normalization";
import type { DiscoveredPosting } from "./discovery";
import type { ScoreComponents } from "./index";

export interface ScoringProfile {
  readonly domainKeywords: readonly string[];
  readonly skillKeywords: readonly string[];
  readonly evidenceKeywords: readonly string[];
  readonly preferredLocations: readonly string[];
  readonly remoteEligible: boolean;
  readonly disqualifyingKeywords: readonly string[];
}

export interface ScoredPosting {
  readonly components: ScoreComponents;
  readonly total: number;
  readonly explanationInputs: {
    readonly domainMatches: readonly string[];
    readonly skillMatches: readonly string[];
    readonly evidenceMatches: readonly string[];
    readonly locationMatched: boolean;
    readonly disqualifyingMatches: readonly string[];
    readonly freshnessDays: number | null;
  };
}

function keywordMatches(haystack: string, keywords: readonly string[]): string[] {
  const normalized = normalizeWhitespace(haystack).toLowerCase();
  return [...new Set(keywords.map((keyword) => normalizeWhitespace(keyword).toLowerCase()))]
    .filter((keyword) => keyword.length > 0 && normalized.includes(keyword))
    .sort();
}

function proportionalScore(matches: number, possible: number, maximum: number): number {
  if (possible === 0) return 0;
  return Math.min(maximum, Math.round((matches / possible) * maximum));
}

export function scorePosting(
  posting: DiscoveredPosting,
  profile: ScoringProfile,
  referenceTime = new Date(),
): ScoredPosting {
  const searchable = [posting.title, posting.description, posting.department ?? "", posting.employmentType ?? ""].join(" ");
  const domainMatches = keywordMatches(searchable, profile.domainKeywords);
  const skillMatches = keywordMatches(searchable, profile.skillKeywords);
  const evidenceMatches = keywordMatches(searchable, profile.evidenceKeywords);
  const disqualifyingMatches = keywordMatches(searchable, profile.disqualifyingKeywords);
  const location = normalizeLocation(posting.location);
  const locationMatched = profile.preferredLocations.some((preferred) => location.includes(normalizeLocation(preferred)))
    || (profile.remoteEligible && location.includes("remote"));

  const postedAt = posting.postedAt === undefined ? null : new Date(posting.postedAt);
  const freshnessDays = postedAt === null || Number.isNaN(postedAt.valueOf())
    ? null
    : Math.max(0, Math.floor((referenceTime.valueOf() - postedAt.valueOf()) / 86_400_000));
  const freshness = freshnessDays === null ? 0 : freshnessDays <= 1 ? 5 : freshnessDays <= 7 ? 4 : freshnessDays <= 30 ? 2 : 0;
  const eligibility = disqualifyingMatches.length === 0 ? 5 : 0;

  const components: ScoreComponents = {
    domain: proportionalScore(domainMatches.length, profile.domainKeywords.length, 30),
    skill: proportionalScore(skillMatches.length, profile.skillKeywords.length, 30),
    evidence: proportionalScore(evidenceMatches.length, profile.evidenceKeywords.length, 20),
    location: locationMatched ? 10 : 0,
    eligibilityFreshness: eligibility + freshness,
  };

  return {
    components,
    total: Object.values(components).reduce((sum, value) => sum + value, 0),
    explanationInputs: {
      domainMatches,
      skillMatches,
      evidenceMatches,
      locationMatched,
      disqualifyingMatches,
      freshnessDays,
    },
  };
}
