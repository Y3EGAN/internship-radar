import { stableContentHash } from "@internship-radar/core";
import type { SourceAdapter } from "../types";
import { list, optionalString, posting, record, requiredString } from "./shared";

export const simplifyAdapter: SourceAdapter = {
  ats: "simplify",
  buildRequest(source) {
    return { url: source.endpointUrl, init: { headers: { accept: "application/json" } } };
  },
  parse(payload, source) {
    return list(payload, "Simplify listings").filter((value) => record(value, "Simplify listing").active !== false).map((value) => {
      const job = record(value, "Simplify listing");
      const url = requiredString(job.url, "Simplify URL");
      const locations = job.locations === undefined ? [] : list(job.locations, "Simplify locations");
      const timestamp = typeof job.date_posted === "number" ? new Date(job.date_posted * 1_000).toISOString() : undefined;
      return posting({
        ats: "simplify",
        externalJobId: stableContentHash(url),
        title: requiredString(job.title, "Simplify title"),
        canonicalUrl: url,
        description: "",
        location: locations.filter((item): item is string => typeof item === "string").join("; "),
        postedAt: timestamp,
        verificationState: "needs_verification",
        metadata: {
          board: source.boardIdentifier,
          company: optionalString(job.company_name) ?? "unknown",
        },
      });
    });
  },
};
