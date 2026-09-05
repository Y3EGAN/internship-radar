import {
  careerPageAnchorPayload,
  careerPageGraphPayload,
  careerPageJsonLdPayload,
  fixtureSources,
} from "@internship-radar/test-fixtures";
import { describe, expect, it } from "vitest";
import { careerPageAdapter } from "./career-page";

describe("career-page adapter", () => {
  it("normalizes a JobPosting JSON-LD object", () => {
    const result = careerPageAdapter.parse(careerPageJsonLdPayload, fixtureSources.careerPage);

    expect(result.rejectedRowCount).toBe(0);
    expect(result.postings).toHaveLength(1);
    expect(result.postings[0]).toMatchObject({
      ats: "career_page",
      externalJobId: "ENG-101",
      companyName: "Example Careers",
      title: "Software Engineering Intern",
      canonicalUrl: "https://jobs.example.invalid/roles/eng-101",
      description: "Build reliable systems.",
      location: "Toronto, ON, CA",
      postedAt: "2026-09-01T00:00:00.000Z",
      closesAt: "2026-10-02T03:59:59.000Z",
      employmentType: "INTERN",
    });
  });

  it("flattens @graph jobs and hashes IDs that are not public", () => {
    const result = careerPageAdapter.parse(careerPageGraphPayload, fixtureSources.careerPage);
    expect(result.postings).toHaveLength(2);
    expect(result.postings.every((posting) => /^[a-f0-9]{64}$/u.test(posting.externalJobId))).toBe(true);
  });

  it("discovers internship-like relative links and ignores ordinary roles", () => {
    const result = careerPageAdapter.parse(careerPageAnchorPayload, fixtureSources.careerPage);
    expect(result.postings).toHaveLength(1);
    expect(result.postings[0]).toMatchObject({
      title: "Student Placement — Platform",
      canonicalUrl: "https://careers.example.invalid/roles/student-301",
      verificationState: "needs_verification",
    });
  });

  it("retains valid jobs beside malformed JSON-LD and deduplicates URLs", () => {
    const payload = `${careerPageJsonLdPayload}<script type="application/ld+json">{broken</script>${careerPageJsonLdPayload}`;
    const result = careerPageAdapter.parse(payload, fixtureSources.careerPage);
    expect(result.postings).toHaveLength(1);
    expect(result.rejectedRowCount).toBe(1);
  });

  it("returns an empty clean result when no jobs are recognized", () => {
    expect(careerPageAdapter.parse("<html><a href='/about'>About us</a></html>", fixtureSources.careerPage))
      .toEqual({ postings: [], rejectedRowCount: 0 });
  });

  it("uses text over HTTP first and offers browser fallback only when configured", () => {
    expect(careerPageAdapter.buildRequest(fixtureSources.careerPage)).toMatchObject({
      responseType: "text",
      transport: "http",
    });
    expect(careerPageAdapter.buildFallbackRequest?.(fixtureSources.careerPage, { postings: [], rejectedRowCount: 0 }))
      .toMatchObject({ responseType: "text", transport: "browser" });
    expect(careerPageAdapter.buildFallbackRequest?.(
      { ...fixtureSources.careerPage, renderMode: "http" },
      { postings: [], rejectedRowCount: 0 },
    )).toBeUndefined();
  });
});
