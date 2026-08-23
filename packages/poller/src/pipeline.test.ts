import { fixtureSources, greenhousePayload } from "@internship-radar/test-fixtures";
import { describe, expect, it, vi } from "vitest";
import { greenhouseAdapter, leverAdapter } from "./adapters";
import { runDiscovery, runSource } from "./pipeline";

describe("failure-isolated discovery", () => {
  it("classifies an empty result without treating it as a transport failure", async () => {
    const result = await runSource(fixtureSources.greenhouse, greenhouseAdapter, {
      fetchImpl: vi.fn().mockResolvedValue(Response.json({ jobs: [] })),
    });
    expect(result).toMatchObject({ status: "empty", attempts: 1, postings: [] });
  });

  it("preserves a healthy source when another source fails", async () => {
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = String(input);
      return Promise.resolve(url.includes("greenhouse")
        ? Response.json(greenhousePayload)
        : new Response("{}", { status: 503 }));
    });
    const adapters = new Map([
      ["greenhouse" as const, greenhouseAdapter],
      ["lever" as const, leverAdapter],
    ]);

    const result = await runDiscovery([fixtureSources.greenhouse, fixtureSources.lever], adapters, {
      fetchImpl,
      maxAttempts: 1,
    });

    expect(result.status).toBe("partial");
    expect(result.postings).toHaveLength(1);
    expect(result.sources.map((source) => source.status)).toEqual(["success", "failed"]);
    expect(result.sources[1]?.issue).toMatchObject({ kind: "server_error", message: "source returned HTTP 503" });
  });

  it("returns failed only when every source fails", async () => {
    const result = await runDiscovery([fixtureSources.greenhouse], new Map(), {});
    expect(result.status).toBe("failed");
    expect(result.sources[0]?.issue?.message).not.toContain(fixtureSources.greenhouse.endpointUrl);
  });
});
