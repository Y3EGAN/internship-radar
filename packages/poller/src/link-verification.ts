import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { DiscoveredPosting, ScoredPosting } from "@internship-radar/core";
import type { LinkVerificationRecord, LinkVerificationStore } from "./postgrest";
import type { FetchLike } from "./types";

const deniedHosts = new Set([
  "github.com", "raw.githubusercontent.com", "camo.githubusercontent.com", "img.shields.io", "i.imgur.com",
  "simplify.jobs", "zapply.jobs", "app.zapply.jobs", "speedyapply.com",
]);
const SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const FAILURE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_REDIRECTS = 5;
const MAX_PER_DOMAIN = 2;

export type AddressLookup = (hostname: string) => Promise<readonly { readonly address: string; readonly family: number }[]>;

function privateAddress(address: string): boolean {
  if (address === "::1" || address === "::" || address.toLowerCase().startsWith("fe80:") || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd")) return true;
  const ipv4 = address.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/u)?.slice(1).map(Number);
  if (ipv4 === undefined) return false;
  const [first = 0, second = 0] = ipv4;
  return first === 0 || first === 10 || first === 127 || first >= 224
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 192 && second === 0)
    || (first === 198 && second === 51)
    || (first === 203 && second === 0)
    || (first === 198 && (second === 18 || second === 19));
}

async function safeUrl(value: string, lookup: AddressLookup): Promise<URL> {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || isIP(hostname) !== 0
    || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")
    || [...deniedHosts].some((denied) => hostname === denied || hostname.endsWith(`.${denied}`))
    || hostname.endsWith(".githubusercontent.com")) {
    throw new Error("unsafe verification destination");
  }
  const addresses = await lookup(hostname);
  if (addresses.length === 0 || addresses.some(({ address }) => privateAddress(address))) throw new Error("unsafe verification destination");
  return url;
}

function retryAfterMilliseconds(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - now);
}

export interface ReachabilityOptions {
  readonly fetchImpl?: FetchLike;
  readonly lookup?: AddressLookup;
  readonly timeoutMs?: number;
  readonly maxAttempts?: number;
  readonly now?: () => number;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly jitter?: (maximum: number) => number;
}

export interface ReachabilityResult {
  readonly reachable: boolean;
  readonly status: number | null;
}

export async function verifyReachable(value: string, options: ReachabilityOptions = {}): Promise<ReachabilityResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const lookup = options.lookup ?? (async (hostname) => dnsLookup(hostname, { all: true, verbatim: true }));
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxAttempts = options.maxAttempts ?? 2;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const jitter = options.jitter ?? ((maximum) => Math.floor(Math.random() * maximum));

  let lastStatus: number | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      let current = await safeUrl(value, lookup);
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        let response: Response;
        try {
          response = await fetchImpl(current, {
            method: "HEAD",
            redirect: "manual",
            headers: { "user-agent": "InternshipRadar-LinkVerifier/1.0" },
            signal: controller.signal,
          });
          if (response.status === 405 || response.status === 501) {
            await response.body?.cancel();
            response = await fetchImpl(current, {
              method: "GET",
              redirect: "manual",
              headers: { "user-agent": "InternshipRadar-LinkVerifier/1.0", range: "bytes=0-0" },
              signal: controller.signal,
            });
          }
        } finally {
          clearTimeout(timeout);
        }
        lastStatus = response.status;
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          await response.body?.cancel();
          if (location === null || redirects === MAX_REDIRECTS) return { reachable: false, status: response.status };
          current = await safeUrl(new URL(location, current).toString(), lookup);
          continue;
        }
        await response.body?.cancel();
        if (response.status >= 200 && response.status < 300) return { reachable: true, status: response.status };
        if (response.status !== 429 && response.status < 500) return { reachable: false, status: response.status };
        const retryAfter = retryAfterMilliseconds(response.headers.get("retry-after"), now());
        if (attempt < maxAttempts) await sleep(Math.min(timeoutMs, retryAfter ?? (250 * (2 ** (attempt - 1)) + jitter(250))));
        break;
      }
    } catch {
      if (attempt < maxAttempts) await sleep(250 * (2 ** (attempt - 1)) + jitter(250));
    }
  }
  return { reachable: false, status: lastStatus };
}

export interface VerificationCandidate {
  readonly posting: DiscoveredPosting;
  readonly score: ScoredPosting;
}

export class LinkVerificationCoordinator {
  private remaining: number;
  private readonly inFlight = new Map<string, Promise<ReachabilityResult>>();
  private readonly activeByDomain = new Map<string, number>();
  private readonly waitingByDomain = new Map<string, Array<() => void>>();

  constructor(
    private readonly ownerId: string,
    private readonly store: LinkVerificationStore,
    private readonly options: ReachabilityOptions & { readonly budget?: number } = {},
  ) {
    this.remaining = options.budget ?? 50;
  }

  private async withDomainSlot<T>(canonicalUrl: string, operation: () => Promise<T>): Promise<T> {
    const hostname = new URL(canonicalUrl).hostname.toLowerCase();
    if ((this.activeByDomain.get(hostname) ?? 0) >= MAX_PER_DOMAIN) {
      await new Promise<void>((resolve) => {
        const waiting = this.waitingByDomain.get(hostname) ?? [];
        waiting.push(resolve);
        this.waitingByDomain.set(hostname, waiting);
      });
    }
    this.activeByDomain.set(hostname, (this.activeByDomain.get(hostname) ?? 0) + 1);
    try {
      return await operation();
    } finally {
      this.activeByDomain.set(hostname, (this.activeByDomain.get(hostname) ?? 1) - 1);
      this.waitingByDomain.get(hostname)?.shift()?.();
    }
  }

  async verify(candidates: readonly VerificationCandidate[]): Promise<readonly VerificationCandidate[]> {
    const secondary = candidates.filter(({ posting }) => posting.verificationState === "needs_verification");
    const now = new Date((this.options.now ?? Date.now)());
    const cached = new Map((await this.store.loadLinkVerifications(this.ownerId, secondary.map(({ posting }) => posting.canonicalUrl), now))
      .map((record) => [record.canonicalUrl, record]));
    const ordered = [...secondary].sort((left, right) => right.score.total - left.score.total
      || Date.parse(right.posting.postedAt ?? "1970-01-01") - Date.parse(left.posting.postedAt ?? "1970-01-01"));
    const promoted = new Set<string>();
    for (const candidate of ordered) {
      const url = candidate.posting.canonicalUrl;
      const hit = cached.get(url);
      if (hit?.outcome === "reachable") {
        promoted.add(url);
        continue;
      }
      if (hit !== undefined || this.remaining <= 0) continue;
      this.remaining -= 1;
      let request = this.inFlight.get(url);
      if (request === undefined) {
        request = this.withDomainSlot(url, () => verifyReachable(url, this.options));
        this.inFlight.set(url, request);
      }
      const result = await request;
      const checkedAt = new Date((this.options.now ?? Date.now)()).toISOString();
      const record: LinkVerificationRecord = {
        canonicalUrl: url,
        outcome: result.reachable ? "reachable" : "unreachable",
        httpStatus: result.status,
        checkedAt,
        expiresAt: new Date(Date.parse(checkedAt) + (result.reachable ? SUCCESS_TTL_MS : FAILURE_TTL_MS)).toISOString(),
      };
      await this.store.saveLinkVerification(this.ownerId, record);
      if (result.reachable) promoted.add(url);
    }
    return candidates.map((candidate) => promoted.has(candidate.posting.canonicalUrl)
      ? { ...candidate, posting: { ...candidate.posting, verificationState: "verified" as const } }
      : candidate);
  }
}
