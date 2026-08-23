import { describe, expect, it } from "vitest";
import { dashboardAccessDecision } from "./access";

describe("dashboard access", () => {
  const owner = "10000000-0000-4000-8000-000000000001";
  it("allows only the configured owner", () => expect(dashboardAccessDecision(owner, owner)).toBe("owner"));
  it("rejects another authenticated user", () => expect(dashboardAccessDecision("20000000-0000-4000-8000-000000000002", owner)).toBe("non_owner"));
  it("rejects anonymous access", () => expect(dashboardAccessDecision(null, owner)).toBe("anonymous"));
});
