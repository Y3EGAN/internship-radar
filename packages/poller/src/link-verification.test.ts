import { discoveredPostingSchema, scorePosting, stableContentHash } from "@internship-radar/core";
import { describe, expect, it, vi } from "vitest";
import type { LinkVerificationRecord, LinkVerificationStore } from "./postgrest";
import { LinkVerificationCoordinator, verifyReachable } from "./link-verification";

const publicLookup = vi.fn().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);

describe("bounded employer-link verification", () => {
  it("accepts a public HTTPS destination with a final 2xx response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(verifyReachable("https://jobs.example.invalid/1", { fetchImpl, lookup: publicLookup, maxAttempts: 1 }))
      .resolves.toEqual({ reachable: true, status: 204 });
  });

  it.each(["http://jobs.example.invalid/1", "https://127.0.0.1/job", "https://raw.githubusercontent.com/example/jobs/main/README.md"])("rejects unsafe destination %s", async (url) => {
    const fetchImpl = vi.fn();
    await expect(verifyReachable(url, { fetchImpl, lookup: publicLookup, maxAttempts: 1 })).resolves.toEqual({ reachable: false, status: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("revalidates redirect destinations and blocks private resolution", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://private.example.invalid/job" } }));
    const lookup = vi.fn(async (hostname: string) => [{ address: hostname.startsWith("private") ? "10.0.0.2" : "8.8.8.8", family: 4 }]);
    await expect(verifyReachable("https://jobs.example.invalid/1", { fetchImpl, lookup, maxAttempts: 1 })).resolves.toEqual({ reachable: false, status: 302 });
  });

  it("honors Retry-After within the two-attempt bound", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const sleep = vi.fn().mockResolvedValue(undefined);
    await expect(verifyReachable("https://jobs.example.invalid/1", { fetchImpl, lookup: publicLookup, sleep, jitter: () => 0 }))
      .resolves.toEqual({ reachable: true, status: 200 });
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("uses fresh cache hits and preserves the new-URL budget", async () => {
    const now = Date.parse("2026-08-31T20:00:00Z");
    const urls = ["https://one.example.invalid/job", "https://two.example.invalid/job", "https://three.example.invalid/job"];
    const records: LinkVerificationRecord[] = [{
      canonicalUrl: urls[0]!, outcome: "reachable", httpStatus: 200,
      checkedAt: new Date(now - 1_000).toISOString(), expiresAt: new Date(now + 60_000).toISOString(),
    }];
    const saved: LinkVerificationRecord[] = [];
    const store: LinkVerificationStore = {
      loadLinkVerifications: async () => records,
      saveLinkVerification: async (_ownerId, record) => { saved.push(record); },
    };
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const candidates = urls.map((url, index) => {
      const posting = discoveredPostingSchema.parse({
        ats: "secondary", externalJobId: `job-${index}`, companyName: `Employer ${index}`, title: "Software Intern",
        normalizedTitle: "software intern", canonicalUrl: url, sourceUrl: "https://raw.example.invalid/repository/README.md",
        description: "", location: "Toronto, ON", normalizedLocation: "toronto on",
        contentHash: stableContentHash(url), verificationState: "needs_verification", metadata: {},
      });
      return { posting, score: scorePosting(posting, { domainKeywords: [], skillKeywords: [], evidenceKeywords: [], preferredLocations: [], remoteEligible: false, disqualifyingKeywords: [] }) };
    });
    const coordinator = new LinkVerificationCoordinator("00000000-0000-0000-0000-000000000001", store, {
      fetchImpl, lookup: publicLookup, now: () => now, maxAttempts: 1, budget: 1,
    });
    const verified = await coordinator.verify(candidates);
    expect(verified.map(({ posting }) => posting.verificationState)).toEqual(["verified", "verified", "needs_verification"]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
  });
});
