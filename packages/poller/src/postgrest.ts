import { sourceDefinitionSchema, type ScoringProfile, type SourceDefinition } from "@internship-radar/core";
import type { PollerRpcClient } from "./repository";

interface SourceEndpointRow {
  readonly id: number;
  readonly owner_id: string;
  readonly ats: string;
  readonly board_identifier: string;
  readonly endpoint_url: string;
  readonly render_mode: string;
  readonly companies: { readonly name: string } | readonly { readonly name: string }[] | null;
}

export interface LinkVerificationRecord {
  readonly canonicalUrl: string;
  readonly outcome: "reachable" | "unreachable";
  readonly httpStatus: number | null;
  readonly checkedAt: string;
  readonly expiresAt: string;
}

export interface LinkVerificationStore {
  loadLinkVerifications(ownerId: string, canonicalUrls: readonly string[], now: Date): Promise<readonly LinkVerificationRecord[]>;
  saveLinkVerification(ownerId: string, record: Omit<LinkVerificationRecord, "canonicalUrl"> & { readonly canonicalUrl: string }): Promise<void>;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function scoringProfileFromCriteria(value: unknown): ScoringProfile {
  const criteria = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    domainKeywords: stringArray(criteria.domainKeywords),
    skillKeywords: stringArray(criteria.skillKeywords),
    evidenceKeywords: stringArray(criteria.evidenceKeywords),
    preferredLocations: stringArray(criteria.preferredLocations),
    remoteEligible: criteria.remoteEligible === true,
    disqualifyingKeywords: stringArray(criteria.disqualifyingKeywords),
  };
}

export class PostgrestPollerDatabase implements PollerRpcClient, LinkVerificationStore {
  private readonly baseUrl: string;

  constructor(
    projectUrl: string,
    private readonly serviceRoleKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = new URL("/rest/v1/", projectUrl).toString();
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImpl(new URL(path, this.baseUrl), {
      ...init,
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  }

  async rpc(functionName: string, args: Readonly<Record<string, unknown>>): Promise<{
    readonly data: unknown | null;
    readonly error: { readonly code?: string } | null;
  }> {
    const response = await this.request(`rpc/${encodeURIComponent(functionName)}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      let code: string | undefined;
      try {
        const body = await response.json() as { readonly code?: unknown };
        if (typeof body.code === "string") code = body.code;
      } catch {
        // The caller receives only a sanitized operation failure.
      }
      return { data: null, error: code === undefined ? {} : { code } };
    }
    return { data: await response.json() as unknown, error: null };
  }

  async listDueSources(ownerId: string, now = new Date(), limit = 250): Promise<readonly SourceDefinition[]> {
    const query = new URLSearchParams({
      select: "id,owner_id,ats,board_identifier,endpoint_url,render_mode,companies!inner(name)",
      owner_id: `eq.${ownerId}`,
      state: "neq.disabled",
      next_due_at: `lte.${now.toISOString()}`,
      order: "next_due_at.asc,id.asc",
      limit: String(limit),
    });
    const response = await this.request(`source_endpoints?${query.toString()}`);
    if (!response.ok) throw new Error("database operation failed: list_due_sources");
    const rows = await response.json() as readonly SourceEndpointRow[];
    return rows.map((row) => {
      const company = Array.isArray(row.companies) ? row.companies[0] : row.companies;
      return sourceDefinitionSchema.parse({
        id: row.id,
        ownerId: row.owner_id,
        ats: row.ats,
        boardIdentifier: row.board_identifier,
        endpointUrl: row.endpoint_url,
        companyName: company?.name,
        renderMode: row.render_mode,
      });
    });
  }

  async loadScoringProfile(ownerId: string): Promise<ScoringProfile> {
    const query = new URLSearchParams({
      select: "targeting_criteria",
      owner_id: `eq.${ownerId}`,
      limit: "1",
    });
    const response = await this.request(`profiles?${query.toString()}`);
    if (!response.ok) throw new Error("database operation failed: load_scoring_profile");
    const rows = await response.json() as readonly { readonly targeting_criteria?: unknown }[];
    return scoringProfileFromCriteria(rows[0]?.targeting_criteria);
  }

  async loadLinkVerifications(ownerId: string, canonicalUrls: readonly string[], now: Date): Promise<readonly LinkVerificationRecord[]> {
    if (canonicalUrls.length === 0) return [];
    const quotedUrls = canonicalUrls.map((url) => `"${url.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`).join(",");
    const query = new URLSearchParams({
      select: "canonical_url,outcome,http_status,checked_at,expires_at",
      owner_id: `eq.${ownerId}`,
      canonical_url: `in.(${quotedUrls})`,
      expires_at: `gt.${now.toISOString()}`,
    });
    const response = await this.request(`link_verifications?${query.toString()}`);
    if (!response.ok) throw new Error("database operation failed: load_link_verifications");
    const rows = await response.json() as readonly {
      canonical_url: string; outcome: "reachable" | "unreachable"; http_status: number | null; checked_at: string; expires_at: string;
    }[];
    return rows.map((row) => ({
      canonicalUrl: row.canonical_url,
      outcome: row.outcome,
      httpStatus: row.http_status,
      checkedAt: row.checked_at,
      expiresAt: row.expires_at,
    }));
  }

  async saveLinkVerification(ownerId: string, record: LinkVerificationRecord): Promise<void> {
    const response = await this.request("link_verifications?on_conflict=owner_id,canonical_url", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        owner_id: ownerId,
        canonical_url: record.canonicalUrl,
        outcome: record.outcome,
        http_status: record.httpStatus,
        checked_at: record.checkedAt,
        expires_at: record.expiresAt,
      }),
    });
    if (!response.ok) throw new Error("database operation failed: save_link_verification");
  }
}
