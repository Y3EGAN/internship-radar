import { describe, expect, it } from "vitest";
import { decodeJobCursor, encodeJobCursor } from "./job-cursor";

describe("job cursor", () => {
  it("round-trips the bigint-style numeric job identity", () => {
    const cursor = encodeJobCursor("2026-08-22T12:00:00.000Z", 42);
    expect(decodeJobCursor(cursor)).toEqual({ discoveredAt: "2026-08-22T12:00:00.000Z", id: "42" });
  });

  it("rejects UUID, zero, malformed date, and extra-field cursors", () => {
    const encoded = (value: string) => Buffer.from(value).toString("base64url");
    expect(decodeJobCursor(encoded("2026-08-22T12:00:00.000Z|00000000-0000-0000-0000-000000000000"))).toBeNull();
    expect(decodeJobCursor(encoded("2026-08-22T12:00:00.000Z|0"))).toBeNull();
    expect(decodeJobCursor(encoded("not-a-date|42"))).toBeNull();
    expect(decodeJobCursor(encoded("2026-08-22T12:00:00.000Z|42|extra"))).toBeNull();
  });
});
