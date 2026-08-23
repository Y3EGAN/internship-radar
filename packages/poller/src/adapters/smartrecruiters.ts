import type { SourceAdapter } from "../types";
import { list, optionalDate, optionalString, posting, record, requiredString } from "./shared";

export const smartRecruitersAdapter: SourceAdapter = {
  ats: "smartrecruiters",
  buildRequest(source) {
    return { url: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.boardIdentifier)}/postings?limit=100&offset=0` };
  },
  parse(payload, source) {
    const root = record(payload, "SmartRecruiters response");
    return list(root.content, "SmartRecruiters content").map((value) => {
      const job = record(value, "SmartRecruiters posting");
      const id = requiredString(job.uuid ?? job.id, "SmartRecruiters id");
      const locationRecord = job.location === undefined ? {} : record(job.location, "SmartRecruiters location");
      const location = [optionalString(locationRecord.city), optionalString(locationRecord.region), optionalString(locationRecord.country)]
        .filter((part): part is string => part !== undefined)
        .join(", ");
      const department = job.department === undefined ? undefined : optionalString(record(job.department, "SmartRecruiters department").label);
      const employment = job.typeOfEmployment === undefined ? undefined : optionalString(record(job.typeOfEmployment, "SmartRecruiters employment").label);
      return posting({
        ats: "smartrecruiters",
        externalJobId: id,
        title: requiredString(job.name ?? job.title, "SmartRecruiters title"),
        canonicalUrl: `https://jobs.smartrecruiters.com/${encodeURIComponent(source.boardIdentifier)}/${encodeURIComponent(id)}`,
        description: optionalString(job.jobAd) ?? "",
        location,
        department,
        employmentType: employment,
        postedAt: optionalDate(job.releasedDate),
        metadata: { board: source.boardIdentifier },
      });
    });
  },
};
