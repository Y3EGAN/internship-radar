import type { SourceAdapter } from "../types";
import { list, optionalDate, optionalString, posting, record, requiredString } from "./shared";

export const ashbyAdapter: SourceAdapter = {
  ats: "ashby",
  buildRequest(source) {
    return { url: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.boardIdentifier)}?includeCompensation=true` };
  },
  parse(payload, source) {
    const root = record(payload, "Ashby response");
    return list(root.jobs, "Ashby jobs")
      .filter((value) => record(value, "Ashby job").isListed !== false)
      .map((value) => {
        const job = record(value, "Ashby job");
        const canonicalUrl = requiredString(job.jobUrl ?? job.applyUrl, "Ashby jobUrl");
        const externalJobId = optionalString(job.id) ?? new URL(canonicalUrl).pathname.split("/").filter(Boolean).at(-1);
        return posting({
          ats: "ashby",
          externalJobId: requiredString(externalJobId, "Ashby id"),
          title: requiredString(job.title, "Ashby title"),
          canonicalUrl,
          description: optionalString(job.descriptionPlain) ?? optionalString(job.descriptionHtml),
          descriptionIsHtml: optionalString(job.descriptionPlain) === undefined,
          location: optionalString(job.location),
          department: optionalString(job.department) ?? optionalString(job.team),
          employmentType: optionalString(job.employmentType),
          postedAt: optionalDate(job.publishedAt),
          metadata: { board: source.boardIdentifier },
        });
      });
  },
};
