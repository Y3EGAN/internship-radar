import type { SourceAdapter } from "../types";
import { list, optionalString, posting, record, requiredString } from "./shared";

export const leverAdapter: SourceAdapter = {
  ats: "lever",
  buildRequest(source) {
    const host = new URL(source.endpointUrl).hostname.includes(".eu.") ? "api.eu.lever.co" : "api.lever.co";
    return { url: `https://${host}/v0/postings/${encodeURIComponent(source.boardIdentifier)}?mode=json` };
  },
  parse(payload, source) {
    const postings = list(payload, "Lever response").map((value) => {
      const job = record(value, "Lever job");
      const categories = job.categories === undefined ? {} : record(job.categories, "Lever categories");
      return posting({
        ats: "lever",
        externalJobId: requiredString(job.id, "Lever id"),
        companyName: source.companyName,
        title: requiredString(job.text, "Lever text"),
        canonicalUrl: requiredString(job.hostedUrl, "Lever hostedUrl"),
        description: optionalString(job.descriptionPlain) ?? optionalString(job.description),
        descriptionIsHtml: optionalString(job.descriptionPlain) === undefined,
        location: optionalString(categories.location),
        department: optionalString(categories.department) ?? optionalString(categories.team),
        employmentType: optionalString(categories.commitment),
        metadata: {
          board: source.boardIdentifier,
          ...(typeof job.workplaceType === "string" ? { workplaceType: job.workplaceType } : {}),
        },
      });
    });
    return { postings, rejectedRowCount: 0 };
  },
};
