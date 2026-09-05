import {
  canadianSecondaryPayload,
  fixtureSources,
  speedySecondaryPayload,
  vanshSecondaryPayload,
  zapplySecondaryPayload,
} from "@internship-radar/test-fixtures";
import { describe, expect, it } from "vitest";
import { secondaryAdapter } from "./secondary";

describe("secondary GitHub Markdown adapter", () => {
  it.each([
    ["Canadian", fixtureSources.canadianSecondary, canadianSecondaryPayload, 2],
    ["Vansh", fixtureSources.vanshSecondary, vanshSecondaryPayload, 2],
    ["Speedy USA", fixtureSources.speedyUsaSecondary, speedySecondaryPayload, 1],
    ["Speedy international", fixtureSources.speedyInternationalSecondary, speedySecondaryPayload, 1],
    ["Zapply", fixtureSources.zapplySecondary, zapplySecondaryPayload, 1],
  ] as const)("parses the sanitized %s feed", (_label, source, payload, count) => {
    const result = secondaryAdapter.parse(payload, source);
    expect(result.postings).toHaveLength(count);
    expect(result.rejectedRowCount).toBe(0);
    expect(result.postings.every((posting) => posting.verificationState === "needs_verification")).toBe(true);
    expect(result.postings.every((posting) => posting.sourceUrl === source.endpointUrl)).toBe(true);
  });

  it("carries explicit company names into ditto rows and strips tracking", () => {
    const result = secondaryAdapter.parse(canadianSecondaryPayload, fixtureSources.canadianSecondary);
    expect(result.postings[1]).toMatchObject({ companyName: "Example Robotics", canonicalUrl: "https://jobs.example.invalid/robotics/802" });
    expect(result.postings[0]?.canonicalUrl).not.toContain("utm_source");
  });

  it("returns a valid empty result for a recognized empty table", () => {
    const result = secondaryAdapter.parse("| Company | Role | Location | Apply | Date Posted |\n|---|---|---|---|---|", fixtureSources.canadianSecondary);
    expect(result).toEqual({ postings: [], rejectedRowCount: 0 });
  });

  it("reports malformed sibling rows without discarding valid postings", () => {
    const payload = `${canadianSecondaryPayload}\n| Company | Role | Location | Apply | Date Posted |\n|---|---|---|---|---|\n| Example Broken | Missing Link Intern | Toronto, ON | unavailable | Aug 28, 2026 |`;
    const result = secondaryAdapter.parse(payload, fixtureSources.canadianSecondary);
    expect(result.postings).toHaveLength(2);
    expect(result.rejectedRowCount).toBe(1);
  });

  it("rejects a payload whose listing-table contract disappeared", () => {
    expect(() => secondaryAdapter.parse("# Promotions only", fixtureSources.canadianSecondary)).toThrow("recognized listings table");
  });
});
