import { describe, expect, it } from "vitest";
import { credentialHash } from "./credential";

describe("device credential hashing", () => {
  it("is deterministic and stores no plaintext", () => {
    const hash = credentialHash("fixture-device-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("fixture-device-token");
  });
});
