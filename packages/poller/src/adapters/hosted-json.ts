import type { SourceAdapter } from "../types";
import { list, optionalDate, optionalString, posting, record, requiredString } from "./shared";

export const hostedJsonAdapter: SourceAdapter = {
  ats: "hosted_json",
  buildRequest(source) {
    return { url: source.endpointUrl, init: { headers: { accept: "application/json" } } };
  },
  parse(payload, source) {
    const rows = Array.isArray(payload) ? payload : list(record(payload, "Hosted JSON response").jobs, "Hosted JSON jobs");
    return rows.map((value) => {
      const job = record(value, "Hosted JSON job");
      const canonicalUrl = requiredString(job.url ?? job.canonicalUrl, "Hosted JSON URL");
      return posting({
        ats: "hosted_json",
        externalJobId: requiredString(job.id ?? canonicalUrl, "Hosted JSON id"),
        title: requiredString(job.title, "Hosted JSON title"),
        canonicalUrl,
        description: optionalString(job.description),
        descriptionIsHtml: optionalString(job.description)?.includes("<"),
        location: optionalString(job.location),
        department: optionalString(job.department),
        employmentType: optionalString(job.employmentType),
        postedAt: optionalDate(job.postedAt),
        closesAt: optionalDate(job.closesAt),
        metadata: { board: source.boardIdentifier },
      });
    });
  },
};
