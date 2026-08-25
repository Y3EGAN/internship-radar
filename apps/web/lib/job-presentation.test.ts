import { describe, expect, it } from "vitest";
import { COMPANY_FALLBACK, formatCompanyName, formatDate, parseSaveJobInput, resolveCompanyName } from "./job-presentation";

describe("company name resolution", () => {
  it("reads both PostgREST embedding shapes", () => {
    expect(resolveCompanyName({ name: "Example Robotics" })).toBe("Example Robotics");
    expect(resolveCompanyName([{ name: "Example Robotics" }])).toBe("Example Robotics");
  });

  it("falls back when the job has no linked company", () => {
    expect(resolveCompanyName(null)).toBeNull();
    expect(resolveCompanyName(undefined)).toBeNull();
    expect(resolveCompanyName([])).toBeNull();
    expect(resolveCompanyName({ name: null })).toBeNull();
    expect(resolveCompanyName({ name: "   " })).toBeNull();
    expect(formatCompanyName(null)).toBe(COMPANY_FALLBACK);
  });

  it("trims stored whitespace", () => {
    expect(resolveCompanyName({ name: "  Example Robotics  " })).toBe("Example Robotics");
  });
});

describe("date formatting", () => {
  it("formats a timestamp in the owner's timezone", () => {
    expect(formatDate("2026-08-22T12:00:00.000Z")).toBe("Aug 22, 2026");
  });

  it("returns the fallback for null and unparseable values", () => {
    expect(formatDate(null)).toBe("Not listed");
    expect(formatDate("not-a-date")).toBe("Not listed");
    expect(formatDate(null, "Never")).toBe("Never");
  });
});

describe("save toggle input", () => {
  it("accepts a positive integer job id with an explicit target state", () => {
    expect(parseSaveJobInput("42", "true")).toEqual({ jobId: 42, saved: true });
    expect(parseSaveJobInput("42", "false")).toEqual({ jobId: 42, saved: false });
  });

  it("rejects non-numeric, zero, negative, fractional, and oversized identifiers", () => {
    expect(parseSaveJobInput("abc", "true")).toBeNull();
    expect(parseSaveJobInput("0", "true")).toBeNull();
    expect(parseSaveJobInput("-1", "true")).toBeNull();
    expect(parseSaveJobInput("1.5", "true")).toBeNull();
    expect(parseSaveJobInput("42; drop table jobs", "true")).toBeNull();
    expect(parseSaveJobInput("9".repeat(20), "true")).toBeNull();
    expect(parseSaveJobInput("9007199254740993", "true")).toBeNull();
  });

  it("rejects a missing, non-string, or unrecognised target state", () => {
    expect(parseSaveJobInput("42", "yes")).toBeNull();
    expect(parseSaveJobInput("42", "")).toBeNull();
    expect(parseSaveJobInput("42", null)).toBeNull();
    expect(parseSaveJobInput(42, "true")).toBeNull();
    expect(parseSaveJobInput(new File([], "x"), "true")).toBeNull();
  });
});
