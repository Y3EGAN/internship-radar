import { stableContentHash } from "@internship-radar/core";
import { load } from "cheerio";
import type { SourceAdapter } from "../types";
import { optionalDate, optionalString, posting, record, requiredString } from "./shared";

const internshipText = /\b(?:intern(?:ship)?|co[\s-]?op|working student|student placement)\b/iu;

function jobPostingNodes(value: unknown): readonly Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(jobPostingNodes);
  if (value === null || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  const current = types.includes("JobPosting") ? [node] : [];
  return [...current, ...jobPostingNodes(node["@graph"])];
}

function resolvedHttpsUrl(value: unknown, baseUrl: string): string {
  const url = new URL(requiredString(value, "Career page job URL"), baseUrl);
  if (url.protocol !== "https:") throw new Error("Career page job URL must use HTTPS");
  return url.toString();
}

function countryName(value: unknown): string | undefined {
  if (typeof value === "string") return optionalString(value);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return optionalString((value as Record<string, unknown>).name);
  }
  return undefined;
}

function locationPart(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const location = value as Record<string, unknown>;
  const address = location.address;
  if (address !== null && typeof address === "object" && !Array.isArray(address)) {
    const fields = address as Record<string, unknown>;
    const pieces = [
      optionalString(fields.addressLocality),
      optionalString(fields.addressRegion),
      countryName(fields.addressCountry),
    ].filter((part): part is string => part !== undefined);
    if (pieces.length > 0) return pieces.join(", ");
  }
  return optionalString(location.name);
}

function jobLocation(value: unknown): string | undefined {
  const values = Array.isArray(value) ? value : [value];
  const locations = values.map(locationPart).filter((part): part is string => part !== undefined);
  return locations.length === 0 ? undefined : locations.join("; ");
}

function identifierValue(value: unknown): string | undefined {
  if (typeof value === "string") return optionalString(value);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const identifier = value as Record<string, unknown>;
    return optionalString(identifier.value ?? identifier.name);
  }
  return undefined;
}

function structuredPosting(job: Record<string, unknown>, source: Parameters<SourceAdapter["parse"]>[1]) {
  const canonicalUrl = resolvedHttpsUrl(job.url, source.endpointUrl);
  const title = requiredString(job.title, "Career page job title");
  const publicId = identifierValue(job.identifier);
  const description = optionalString(job.description);
  return posting({
    ats: "career_page",
    externalJobId: publicId ?? stableContentHash(canonicalUrl),
    companyName: source.companyName,
    title,
    canonicalUrl,
    description,
    descriptionIsHtml: description?.includes("<"),
    location: jobLocation(job.jobLocation),
    employmentType: Array.isArray(job.employmentType)
      ? job.employmentType.filter((value): value is string => typeof value === "string").join(", ")
      : optionalString(job.employmentType),
    postedAt: optionalDate(job.datePosted),
    closesAt: optionalDate(job.validThrough),
    metadata: { board: source.boardIdentifier, discovery: "json_ld" },
  });
}

export const careerPageAdapter: SourceAdapter = {
  ats: "career_page",
  buildRequest(source) {
    return {
      url: source.endpointUrl,
      responseType: "text",
      transport: "http",
      init: { headers: { accept: "text/html,application/xhtml+xml" } },
    };
  },
  buildFallbackRequest(source) {
    if (source.renderMode !== "browser") return undefined;
    return {
      url: source.endpointUrl,
      responseType: "text",
      transport: "browser",
      init: { headers: { accept: "text/html,application/xhtml+xml" } },
    };
  },
  parse(payload, source) {
    if (typeof payload !== "string") throw new Error("Career page response must be text");
    const $ = load(payload);
    const postingsByUrl = new Map<string, ReturnType<typeof posting>>();
    let rejectedRowCount = 0;

    $('script[type="application/ld+json"]').each((_index, element) => {
      try {
        const parsed = JSON.parse($(element).text()) as unknown;
        for (const job of jobPostingNodes(parsed)) {
          try {
            const normalized = structuredPosting(record(job, "Career page job"), source);
            postingsByUrl.set(normalized.canonicalUrl, normalized);
          } catch {
            rejectedRowCount += 1;
          }
        }
      } catch {
        rejectedRowCount += 1;
      }
    });

    $("a[href]").each((_index, element) => {
      const title = $(element).text().replace(/\s+/gu, " ").trim();
      if (!internshipText.test(title)) return;
      try {
        const canonicalUrl = resolvedHttpsUrl($(element).attr("href"), source.endpointUrl);
        const normalized = posting({
          ats: "career_page",
          externalJobId: stableContentHash(canonicalUrl),
          companyName: source.companyName,
          title,
          canonicalUrl,
          verificationState: "needs_verification",
          metadata: { board: source.boardIdentifier, discovery: "anchor" },
        });
        if (!postingsByUrl.has(normalized.canonicalUrl)) postingsByUrl.set(normalized.canonicalUrl, normalized);
      } catch {
        rejectedRowCount += 1;
      }
    });

    return { postings: [...postingsByUrl.values()], rejectedRowCount };
  },
};
