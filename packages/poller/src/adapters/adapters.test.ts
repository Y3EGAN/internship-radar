import {
  ashbyPayload,
  fixtureSources,
  greenhousePayload,
  hostedJsonPayload,
  leverPayload,
  simplifyPayload,
  smartRecruitersPayload,
  workdayPayload,
} from "@internship-radar/test-fixtures";
import { describe, expect, it } from "vitest";
import {
  ashbyAdapter,
  greenhouseAdapter,
  hostedJsonAdapter,
  leverAdapter,
  simplifyAdapter,
  smartRecruitersAdapter,
  workdayAdapter,
} from "./index";

describe("ATS adapters", () => {
  it.each([
    ["greenhouse", greenhouseAdapter, greenhousePayload],
    ["lever", leverAdapter, leverPayload],
    ["ashby", ashbyAdapter, ashbyPayload],
    ["workday", workdayAdapter, workdayPayload],
    ["smartrecruiters", smartRecruitersAdapter, smartRecruitersPayload],
    ["hosted_json", hostedJsonAdapter, hostedJsonPayload],
    ["simplify", simplifyAdapter, simplifyPayload],
  ] as const)("normalizes a sanitized %s fixture", (key, adapter, payload) => {
    const { postings } = adapter.parse(payload, fixtureSources[key]);
    expect(postings).toHaveLength(1);
    expect(postings[0]).toMatchObject({ ats: key, normalizedLocation: expect.any(String) });
    expect(postings[0]?.canonicalUrl).not.toMatch(/(?:utm_|gh_src|lever-source)/u);
    expect(postings[0]?.contentHash).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("treats the secondary feed as unverified until an employer URL is resolved", () => {
    expect(simplifyAdapter.parse(simplifyPayload, fixtureSources.simplify).postings[0]?.verificationState).toBe("needs_verification");
  });

  it("builds bounded public discovery requests without application endpoints", () => {
    expect(greenhouseAdapter.buildRequest(fixtureSources.greenhouse).url).toContain("boards-api.greenhouse.io");
    expect(leverAdapter.buildRequest(fixtureSources.lever).url).toContain("mode=json");
    expect(ashbyAdapter.buildRequest(fixtureSources.ashby).url).toContain("posting-api/job-board");
    expect(workdayAdapter.buildRequest(fixtureSources.workday).init?.method).toBe("POST");
    expect(JSON.parse(String(workdayAdapter.buildRequest(fixtureSources.workday).init?.body))).toMatchObject({ limit: 20 });
    expect(smartRecruitersAdapter.buildRequest(fixtureSources.smartrecruiters).url).toContain("/postings");
  });

  it("rejects malformed fixture payloads", () => {
    expect(() => greenhouseAdapter.parse({ jobs: [{ title: "Missing fields" }] }, fixtureSources.greenhouse)).toThrow();
    expect(() => leverAdapter.parse({ postings: [] }, fixtureSources.lever)).toThrow("array");
  });
});
