import { careerPageJsonLdPayload, fixtureSources, greenhousePayload } from "@internship-radar/test-fixtures";
import { describe, expect, it, vi } from "vitest";
import { careerPageAdapter, greenhouseAdapter, leverAdapter } from "./adapters";
import { runDiscovery, runSource } from "./pipeline";
import type { SourceAdapter } from "./types";

describe("failure-isolated discovery", () => {
  it("falls back to rendered HTML when an HTTP careers page contains no jobs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("<html><main>Loading</main></html>"));
    const renderFetchImpl = vi.fn().mockResolvedValue(new Response(careerPageJsonLdPayload));

    const result = await runSource(fixtureSources.careerPage, careerPageAdapter, { fetchImpl, renderFetchImpl });

    expect(result).toMatchObject({ status: "success", attempts: 2 });
    expect(result.postings).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(renderFetchImpl).toHaveBeenCalledOnce();
  });

  it("skips rendered fallback when the HTTP careers page already contains jobs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(careerPageJsonLdPayload));
    const renderFetchImpl = vi.fn();

    const result = await runSource(fixtureSources.careerPage, careerPageAdapter, { fetchImpl, renderFetchImpl });

    expect(result).toMatchObject({ status: "success", attempts: 1 });
    expect(result.postings).toHaveLength(1);
    expect(renderFetchImpl).not.toHaveBeenCalled();
  });

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

  it("keeps valid rows and reports a sanitized partial payload", async () => {
    const adapter: SourceAdapter = {
      ats: "greenhouse",
      buildRequest: () => ({ url: fixtureSources.greenhouse.endpointUrl }),
      parse: () => ({ postings: greenhouseAdapter.parse(greenhousePayload, fixtureSources.greenhouse).postings, rejectedRowCount: 1 }),
    };
    const result = await runSource(fixtureSources.greenhouse, adapter, {
      fetchImpl: vi.fn().mockResolvedValue(Response.json(greenhousePayload)),
    });
    expect(result).toMatchObject({ status: "partial" });
    expect(result.postings).toHaveLength(1);
    expect(result.issue).toEqual({ kind: "partial_payload", message: "source payload contained 1 rejected row", retryable: false });
  });
});
