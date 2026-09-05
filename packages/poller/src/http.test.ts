import { describe, expect, it, vi } from "vitest";
import { requestJson, SourceRequestError } from "./http";

const request = { url: "https://api.example.invalid/jobs" } as const;

describe("bounded source HTTP client", () => {
  it("routes browser requests through the rendered transport", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("plain"));
    const renderFetchImpl = vi.fn().mockResolvedValue(new Response("<main>rendered</main>"));

    const response = await requestJson(
      { ...request, responseType: "text", transport: "browser" },
      { fetchImpl, renderFetchImpl },
    );

    expect(response.payload).toBe("<main>rendered</main>");
    expect(renderFetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails safely when browser transport is unavailable", async () => {
    await expect(requestJson(
      { url: "https://secret.example.invalid/private", responseType: "text", transport: "browser" },
      { fetchImpl: vi.fn() },
    )).rejects.toMatchObject({
      kind: "network_error",
      retryable: false,
      message: "rendered source transport is unavailable",
    });
  });

  it("honors Retry-After on 429 and succeeds on a bounded retry", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(Response.json({ jobs: [] }));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const response = await requestJson(request, { fetchImpl, sleep, jitter: () => 0 });
    expect(response.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it("retries 5xx responses only to the configured attempt bound", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 503 }));
    await expect(requestJson(request, { fetchImpl, maxAttempts: 2, sleep: async () => undefined, jitter: () => 0 }))
      .rejects.toMatchObject({ kind: "server_error", status: 503 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("classifies timeouts without exposing request details", async () => {
    const fetchImpl = vi.fn((_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));

    await expect(requestJson(request, { fetchImpl, timeoutMs: 1, maxAttempts: 1 }))
      .rejects.toMatchObject({ kind: "timeout", retryable: true });
  });

  it("does not retry malformed JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("not-json", { status: 200 }));
    await expect(requestJson(request, { fetchImpl })).rejects.toEqual(expect.any(SourceRequestError));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not retry ordinary 4xx responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    await expect(requestJson(request, { fetchImpl })).rejects.toMatchObject({ kind: "http_error", retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
