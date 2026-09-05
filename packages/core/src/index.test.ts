import { describe, expect, it } from "vitest";
import { isCanadaOrUnitedStatesLocation, isTargetInternship, sourceDefinitionSchema } from "./discovery";
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

describe("Canada and United States location eligibility", () => {
  it.each(["Toronto, ON", "Vancouver, Canada", "Austin, TX", "New York, United States", "Remote - Canada", "North America Remote"])("includes %s", (location) => {
    expect(isCanadaOrUnitedStatesLocation(location)).toBe(true);
  });

  it.each(["Remote", "Mexico City, Mexico", "London, United Kingdom", "Worldwide"])("excludes %s", (location) => {
    expect(isCanadaOrUnitedStatesLocation(location)).toBe(false);
  });
});

describe("source definition contract", () => {
  const source = {
    id: 13,
    ownerId: "40000000-0000-4000-8000-000000000004",
    ats: "career_page",
    boardIdentifier: "example-careers",
    endpointUrl: "https://careers.example.invalid/jobs",
    companyName: "Example Careers",
  };

  it("accepts a browser-rendered careers page", () => {
    expect(sourceDefinitionSchema.parse({ ...source, renderMode: "browser" })).toMatchObject({
      ats: "career_page",
      renderMode: "browser",
    });
  });

  it("defaults an ordinary source to HTTP and rejects unknown render modes", () => {
    expect(sourceDefinitionSchema.parse({ ...source, ats: "greenhouse" })).toMatchObject({ renderMode: "http" });
    expect(() => sourceDefinitionSchema.parse({ ...source, renderMode: "interactive" })).toThrow();
  });
});
