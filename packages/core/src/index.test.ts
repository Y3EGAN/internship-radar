import { describe, expect, it } from "vitest";
import { isTargetInternship } from "./discovery";
import { scoreComponentSchema, totalScore } from "./index";

describe("score bounds", () => {
  it("accepts a complete 100-point score", () => {
    const score = scoreComponentSchema.parse({
      domain: 30,
      skill: 30,
      evidence: 20,
      location: 10,
      eligibilityFreshness: 10,
    });

    expect(totalScore(score)).toBe(100);
  });

  it("rejects a component above its configured bound", () => {
    expect(() =>
      scoreComponentSchema.parse({
        domain: 31,
        skill: 0,
        evidence: 0,
        location: 0,
        eligibilityFreshness: 0,
      }),
    ).toThrow();
  });
});

describe("internship discovery boundary", () => {
  it.each([
    ["Robotics Software Intern", undefined],
    ["Controls Co-op", undefined],
    ["Software Engineer", "Internship"],
    ["Working Student, Machine Learning", undefined],
  ])("accepts an explicit internship signal in %s", (title, employmentType) => {
    expect(isTargetInternship({ title, ...(employmentType ? { employmentType } : {}) })).toBe(true);
  });

  it.each([
    ["Senior Software Engineer", undefined],
    ["Internal Tools Engineer", undefined],
    ["Student Success Manager", undefined],
    ["Graduate Software Engineer", "Full-time"],
  ])("rejects a non-internship posting in %s", (title, employmentType) => {
    expect(isTargetInternship({ title, ...(employmentType ? { employmentType } : {}) })).toBe(false);
  });
});
