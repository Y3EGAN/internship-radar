import { createHash } from "node:crypto";

const TRACKING_PARAMETERS = new Set([
  "gh_src",
  "lever-source",
  "source",
  "sourceid",
  "trk",
  "trackingid",
]);

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  "&amp;": "&",
  "&apos;": "'",
  "&#39;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": '"',
};

export function normalizeWhitespace(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/[\u201C\u201D]/gu, '"')
    .replace(/\s+/gu, " ")
    .trim();
}

export function stripHtml(value: string): string {
  const withoutMarkup = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/p\s*>/giu, "\n")
    .replace(/<[^>]+>/gu, " ");

  const decoded = withoutMarkup
    .replace(/&(amp|apos|gt|lt|nbsp|quot|#39);/giu, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? " ")
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/giu, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));

  return normalizeWhitespace(decoded);
}

export function normalizeTitle(value: string): string {
  return normalizeWhitespace(stripHtml(value))
    .toLowerCase()
    .replace(/\bco[\s-]?op\b/gu, "internship")
    .replace(/\bintern\b/gu, "internship")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeLocation(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\bgreater toronto area\b|\bgta\b/gu, "toronto")
    .replace(/\bontario\b/gu, "on")
    .replace(/\bremote[\s-]*canada\b/gu, "canada remote")
    .replace(/[^\p{L}\p{N},]+/gu, " ")
    .replace(/\s*,\s*/gu, ", ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("canonical URLs must use HTTPS");

  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMETERS.has(key.toLowerCase())) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, "");
  return url.toString();
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function stableContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

export function postingFingerprint(company: string, title: string, location: string): string {
  return stableContentHash({
    company: normalizeWhitespace(company).toLowerCase(),
    location: normalizeLocation(location),
    title: normalizeTitle(title),
  });
}
