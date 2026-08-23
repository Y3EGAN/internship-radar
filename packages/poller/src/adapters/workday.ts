import type { SourceAdapter } from "../types";
import { list, optionalString, posting, record, requiredString } from "./shared";

function workdayCanonicalUrl(endpointUrl: string, boardIdentifier: string, externalPath: string): string {
  const endpoint = new URL(endpointUrl);
  const path = externalPath.startsWith("/") ? externalPath : `/${externalPath}`;
  return `https://${endpoint.hostname}/en-US/${encodeURIComponent(boardIdentifier)}${path}`;
}

export const workdayAdapter: SourceAdapter = {
  ats: "workday",
  buildRequest(source) {
    return {
      url: source.endpointUrl,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 100, offset: 0, searchText: "" }),
      },
    };
  },
  parse(payload, source) {
    const root = record(payload, "Workday response");
    return list(root.jobPostings, "Workday jobPostings").map((value) => {
      const job = record(value, "Workday job");
      const externalPath = requiredString(job.externalPath, "Workday externalPath");
      const bulletFields = job.bulletFields === undefined ? [] : list(job.bulletFields, "Workday bulletFields");
      return posting({
        ats: "workday",
        externalJobId: optionalString(job.externalJobId) ?? externalPath,
        title: requiredString(job.title, "Workday title"),
        canonicalUrl: workdayCanonicalUrl(source.endpointUrl, source.boardIdentifier, externalPath),
        description: bulletFields.filter((item): item is string => typeof item === "string").join("\n"),
        location: optionalString(job.locationsText),
        postedAt: optionalString(job.postedOn),
        metadata: { board: source.boardIdentifier },
      });
    });
  },
};
