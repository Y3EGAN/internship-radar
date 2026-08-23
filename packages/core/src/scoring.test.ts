import { describe, expect, it } from "vitest";
import { discoveredPostingSchema } from "./discovery";
import { scorePosting } from "./scoring";

const posting = discoveredPostingSchema.parse({
  ats: "greenhouse",
  externalJobId: "fixture-1",
  title: "Robotics Software Internship",
  normalizedTitle: "robotics software internship",
  canonicalUrl: "https://jobs.example.invalid/fixture-1",
  sourceUrl: "https://jobs.example.invalid/fixture-1",
  description: "Develop C++ controls for autonomous robots and test perception systems.",
  location: "Toronto, ON",
  normalizedLocation: "toronto, on",
  postedAt: "2026-08-21T12:00:00.000Z",
  contentHash: "a".repeat(64),
  verificationState: "verified",
  metadata: {},
});

describe("deterministic scoring", () => {
  it("keeps every component within the 100-point model", () => {
    const score = scorePosting(posting, {
      domainKeywords: ["robotics", "autonomous"],
      skillKeywords: ["c++", "controls", "perception"],
      evidenceKeywords: ["robots", "test"],
      preferredLocations: ["Toronto"],
      remoteEligible: false,
      disqualifyingKeywords: ["citizenship required"],
    }, new Date("2026-08-22T12:00:00.000Z"));

    expect(score.components).toEqual({
      domain: 30,
      skill: 30,
      evidence: 20,
      location: 10,
      eligibilityFreshness: 10,
    });
    expect(score.total).toBe(100);
  });

  it("does not award eligibility when a disqualifier is present", () => {
    const disqualified = { ...posting, description: `${posting.description} Citizenship required.` };
    const score = scorePosting(disqualified, {
      domainKeywords: [], skillKeywords: [], evidenceKeywords: [], preferredLocations: [], remoteEligible: false,
      disqualifyingKeywords: ["citizenship required"],
    }, new Date("2026-08-22T12:00:00.000Z"));

    expect(score.components.eligibilityFreshness).toBe(5);
    expect(score.explanationInputs.disqualifyingMatches).toEqual(["citizenship required"]);
  });
});
