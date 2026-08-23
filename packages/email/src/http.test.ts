import { describe, expect, it, vi } from "vitest";
import { readJsonResponse } from "./http";

describe("readJsonResponse", () => {
  it("accepts a successful no-content RPC response", async () => {
    const json = vi.fn();
    await expect(readJsonResponse({ status: 204, json })).resolves.toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it("parses JSON responses", async () => {
    await expect(readJsonResponse({ status: 200, json: async () => ({ ok: true }) })).resolves.toEqual({ ok: true });
  });
});
