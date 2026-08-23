import type { DiscoveredPosting } from "@internship-radar/core";

export interface DeduplicationWarning {
  readonly kind: "external_id_conflict" | "canonical_url_duplicate" | "fuzzy_review";
  readonly keptExternalJobId: string;
  readonly candidateExternalJobId: string;
}

export interface DeduplicationResult {
  readonly postings: readonly DiscoveredPosting[];
  readonly warnings: readonly DeduplicationWarning[];
}

function tokens(value: string): ReadonlySet<string> {
  return new Set(value.split(/\s+/u).filter(Boolean));
}

function jaccard(left: string, right: string): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  const union = new Set([...leftTokens, ...rightTokens]);
  if (union.size === 0) return 0;
  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / union.size;
}

export function deduplicatePostings(input: readonly DiscoveredPosting[]): DeduplicationResult {
  const postings: DiscoveredPosting[] = [];
  const warnings: DeduplicationWarning[] = [];
  const externalKeys = new Map<string, DiscoveredPosting>();
  const canonicalUrls = new Map<string, DiscoveredPosting>();

  for (const candidate of input) {
    const externalKey = `${candidate.ats}:${candidate.externalJobId}`;
    const externalMatch = externalKeys.get(externalKey);
    if (externalMatch !== undefined) {
      if (externalMatch.contentHash !== candidate.contentHash) {
        warnings.push({ kind: "external_id_conflict", keptExternalJobId: externalMatch.externalJobId, candidateExternalJobId: candidate.externalJobId });
      }
      continue;
    }

    const canonicalMatch = canonicalUrls.get(candidate.canonicalUrl);
    if (canonicalMatch !== undefined) {
      warnings.push({ kind: "canonical_url_duplicate", keptExternalJobId: canonicalMatch.externalJobId, candidateExternalJobId: candidate.externalJobId });
      externalKeys.set(externalKey, canonicalMatch);
      continue;
    }

    for (const existing of postings) {
      const sameBoard = existing.metadata.board === candidate.metadata.board;
      const sameLocation = existing.normalizedLocation === candidate.normalizedLocation;
      if (sameBoard && sameLocation && jaccard(existing.normalizedTitle, candidate.normalizedTitle) >= 0.75) {
        warnings.push({ kind: "fuzzy_review", keptExternalJobId: existing.externalJobId, candidateExternalJobId: candidate.externalJobId });
        break;
      }
    }

    postings.push(candidate);
    externalKeys.set(externalKey, candidate);
    canonicalUrls.set(candidate.canonicalUrl, candidate);
  }

  return { postings, warnings };
}
