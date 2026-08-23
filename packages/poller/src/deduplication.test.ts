import { fixtureSources, greenhousePayload } from "@internship-radar/test-fixtures";
import { describe, expect, it } from "vitest";
import { greenhouseAdapter } from "./adapters";
import { deduplicatePostings } from "./deduplication";

describe("deduplication", () => {
  const original = greenhouseAdapter.parse(greenhousePayload, fixtureSources.greenhouse)[0]!;

  it("deduplicates stable ATS IDs", () => {
    const result = deduplicatePostings([original, original]);
    expect(result.postings).toHaveLength(1);
  });

  it("flags changed content for the same external posting", () => {
    const changedPayload = structuredClone(greenhousePayload);
    changedPayload.jobs[0]!.content = "<p>Build and deploy changed robot controls.</p>";
    const changed = greenhouseAdapter.parse(changedPayload, fixtureSources.greenhouse)[0]!;
    const result = deduplicatePostings([original, changed]);
    expect(changed.contentHash).not.toBe(original.contentHash);
    expect(result.warnings).toContainEqual(expect.objectContaining({ kind: "external_id_conflict" }));
  });

  it("deduplicates canonical URLs after tracking removal", () => {
    const canonicalDuplicate = { ...original, ats: "hosted_json" as const, externalJobId: "other-id" };
    const result = deduplicatePostings([original, canonicalDuplicate]);
    expect(result.postings).toHaveLength(1);
    expect(result.warnings[0]?.kind).toBe("canonical_url_duplicate");
  });

  it("emits fuzzy similarity as a review warning without merging", () => {
    const fuzzy = {
      ...original,
      externalJobId: "similar-id",
      canonicalUrl: "https://boards.greenhouse.io/example-robotics/jobs/similar-id",
      sourceUrl: "https://boards.greenhouse.io/example-robotics/jobs/similar-id",
      normalizedTitle: "robotics software internship toronto",
    };
    const result = deduplicatePostings([original, fuzzy]);
    expect(result.postings).toHaveLength(2);
    expect(result.warnings).toContainEqual(expect.objectContaining({ kind: "fuzzy_review" }));
  });
});
