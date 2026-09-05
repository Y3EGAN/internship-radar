import type { SourceDefinition } from "@internship-radar/core";
import type { SourceAdapter } from "../types";
import { list, optionalDate, optionalString, posting, record, requiredString } from "./shared";

export const greenhouseAdapter: SourceAdapter = {
  ats: "greenhouse",
  buildRequest(source) {
    return { url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.boardIdentifier)}/jobs?content=false` };
  },
  parse(payload, source: SourceDefinition) {
    const root = record(payload, "Greenhouse response");
    const postings = list(root.jobs, "Greenhouse jobs").map((value) => {
      const job = record(value, "Greenhouse job");
      const location = job.location === undefined ? undefined : optionalString(record(job.location, "Greenhouse location").name);
      const departments = job.departments === undefined ? [] : list(job.departments, "Greenhouse departments");
      const department = departments.length === 0 ? undefined : optionalString(record(departments[0], "Greenhouse department").name);
      return posting({
        ats: "greenhouse",
        externalJobId: String(job.id),
        companyName: source.companyName,
        title: requiredString(job.title, "Greenhouse title"),
        canonicalUrl: requiredString(job.absolute_url, "Greenhouse absolute_url"),
        description: optionalString(job.content),
        descriptionIsHtml: true,
        location,
        department,
        postedAt: optionalDate(job.updated_at),
        metadata: { board: source.boardIdentifier },
      });
    });
    return { postings, rejectedRowCount: 0 };
  },
};
