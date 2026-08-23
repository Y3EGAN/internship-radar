import { describe, expect, it } from "vitest";
import { isAuthorizedCodexRequest } from "./codex-auth";

describe("Codex preparation API authorization", () => {
  const token = "fixture-token-that-is-at-least-32-characters";
  it("accepts the exact bearer token", () => expect(isAuthorizedCodexRequest(`Bearer ${token}`, token)).toBe(true));
  it("rejects missing, short, and mismatched tokens", () => {
    expect(isAuthorizedCodexRequest(null, token)).toBe(false);
    expect(isAuthorizedCodexRequest("Bearer wrong", token)).toBe(false);
    expect(isAuthorizedCodexRequest(`Bearer ${token}`, "short")).toBe(false);
  });
});
