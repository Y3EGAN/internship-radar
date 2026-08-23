import { describe, expect, it, vi } from "vitest";
import { PostgrestPollerDatabase, scoringProfileFromCriteria } from "./postgrest";

describe("PostgREST poller database", () => {
  it("loads due sources with server-only authorization", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json([{
      id: 17,
      owner_id: "40000000-0000-4000-8000-000000000004",
      ats: "greenhouse",
      board_identifier: "fixture-board",
      endpoint_url: "https://boards-api.greenhouse.io/v1/boards/fixture-board/jobs",
      companies: { name: "Fixture Board" },
    }]));
    const database = new PostgrestPollerDatabase("https://project.example.invalid", "fixture-service-key", fetchImpl);
    const sources = await database.listDueSources("40000000-0000-4000-8000-000000000004");

    expect(sources[0]).toMatchObject({ id: 17, companyName: "Fixture Board", ats: "greenhouse" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toContain("source_endpoints?");
    expect(init.headers).toMatchObject({ apikey: "fixture-service-key", Authorization: "Bearer fixture-service-key" });
  });

  it("returns only a database error code from failed RPC responses", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json(
      { code: "23505", message: "sensitive backend detail" },
      { status: 409 },
    ));
    const database = new PostgrestPollerDatabase("https://project.example.invalid", "fixture-service-key", fetchImpl);
    await expect(database.rpc("fixture_rpc", {})).resolves.toEqual({ data: null, error: { code: "23505" } });
  });

  it("fails closed to bounded empty criteria when fields are malformed", () => {
    expect(scoringProfileFromCriteria({
      domainKeywords: ["robotics", 42],
      skillKeywords: "not-an-array",
      remoteEligible: "yes",
    })).toEqual({
      domainKeywords: ["robotics"],
      skillKeywords: [],
      evidenceKeywords: [],
      preferredLocations: [],
      remoteEligible: false,
      disqualifyingKeywords: [],
    });
  });
});
