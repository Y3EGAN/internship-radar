import { canonicalizeUrl, stableContentHash } from "@internship-radar/core";
import type { SourceAdapter } from "../types";
import { posting } from "./shared";

interface TableColumns {
  readonly company: number;
  readonly title: number;
  readonly location: number;
  readonly application: number;
  readonly posted?: number;
}

const monthDate = /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}$/iu;
const ignoredApplicationHosts = new Set([
  "github.com",
  "raw.githubusercontent.com",
  "camo.githubusercontent.com",
  "img.shields.io",
  "i.imgur.com",
  "simplify.jobs",
  "zapply.jobs",
  "app.zapply.jobs",
  "speedyapply.com",
]);

function splitRow(line: string): string[] {
  const value = line.trim().replace(/^\|/u, "").replace(/\|$/u, "");
  const cells: string[] = [];
  let current = "";
  let escaped = false;
  for (const character of value) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === "\\") {
      current += character;
      escaped = true;
    } else if (character === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function cleanText(value: string): string {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/[*_`]/gu, "")
    .replace(/&amp;/giu, "&")
    .replace(/&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function headerKey(value: string): string {
  return cleanText(value).toLowerCase().replace(/[^a-z]+/gu, " ").trim();
}

function findColumn(headers: readonly string[], candidates: readonly string[]): number {
  return headers.findIndex((header) => candidates.some((candidate) => header === candidate || header.includes(candidate)));
}

function columnsFor(line: string): TableColumns | null {
  const headers = splitRow(line).map(headerKey);
  const company = findColumn(headers, ["company"]);
  const title = findColumn(headers, ["role", "position"]);
  const location = findColumn(headers, ["location"]);
  const application = findColumn(headers, ["apply", "application", "posting"]);
  const posted = findColumn(headers, ["date posted", "posted", "age"]);
  if ([company, title, location, application].some((index) => index < 0)) return null;
  return { company, title, location, application, ...(posted < 0 ? {} : { posted }) };
}

function isSeparator(cells: readonly string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
}

function applicationUrl(cell: string): string | null {
  const candidates = [
    ...[...cell.matchAll(/href=["'](https:\/\/[^"']+)["']/giu)].map((match) => match[1]),
    ...[...cell.matchAll(/\]\((https:\/\/[^)\s]+)\)/giu)].map((match) => match[1]),
    ...[...cell.matchAll(/https:\/\/[^\s)"'<>]+/giu)].map((match) => match[0]),
  ].filter((value): value is string => value !== undefined);
  for (const candidate of candidates.reverse()) {
    try {
      const url = new URL(candidate.replace(/&amp;/giu, "&"));
      if (url.protocol === "https:" && !ignoredApplicationHosts.has(url.hostname.toLowerCase())) return canonicalizeUrl(url.toString());
    } catch {
      // Ignore malformed links within a row and continue looking for the employer link.
    }
  }
  return null;
}

function absolutePostedAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = cleanText(value);
  if (!monthDate.test(cleaned)) return undefined;
  const parsed = new Date(`${cleaned} 00:00:00 UTC`);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed.toISOString();
}

export const secondaryAdapter: SourceAdapter = {
  ats: "secondary",
  buildRequest(source) {
    return {
      url: source.endpointUrl,
      responseType: "text",
      init: { headers: { accept: "text/plain; charset=utf-8", "user-agent": "InternshipRadar/1.0" } },
    };
  },
  parse(payload, source) {
    if (typeof payload !== "string") throw new Error("Secondary feed must be text");
    const postings = [];
    let rejectedRowCount = 0;
    let recognizedTables = 0;
    let columns: TableColumns | null = null;
    let lastCompany: string | undefined;

    for (const line of payload.split(/\r?\n/gu)) {
      if (!line.trim().startsWith("|")) {
        columns = null;
        lastCompany = undefined;
        continue;
      }
      const possibleHeader = columnsFor(line);
      if (possibleHeader !== null) {
        columns = possibleHeader;
        lastCompany = undefined;
        recognizedTables += 1;
        continue;
      }
      if (columns === null) continue;
      const cells = splitRow(line);
      if (isSeparator(cells)) continue;
      const maximumIndex = Math.max(columns.company, columns.title, columns.location, columns.application, columns.posted ?? 0);
      if (cells.length <= maximumIndex) {
        rejectedRowCount += 1;
        continue;
      }
      const companyCell = cleanText(cells[columns.company] ?? "");
      const dittoCompany = companyCell === "↳" || companyCell === "";
      const companyName = dittoCompany ? lastCompany : companyCell;
      if (!dittoCompany) lastCompany = companyCell;
      const title = cleanText(cells[columns.title] ?? "");
      const location = cleanText(cells[columns.location] ?? "");
      const applyCell = cells[columns.application] ?? "";
      if (/\bclosed\b|🔒/iu.test(applyCell)) continue;
      const canonicalUrl = applicationUrl(applyCell);
      if (companyName === undefined || companyName === "" || title === "" || location === "" || canonicalUrl === null) {
        rejectedRowCount += 1;
        continue;
      }
      postings.push(posting({
        ats: "secondary",
        externalJobId: stableContentHash(canonicalUrl),
        companyName,
        title,
        canonicalUrl,
        sourceUrl: source.endpointUrl,
        location,
        postedAt: absolutePostedAt(columns.posted === undefined ? undefined : cells[columns.posted]),
        verificationState: "needs_verification",
        metadata: { board: source.boardIdentifier },
      }));
    }

    if (recognizedTables === 0) throw new Error("Secondary feed did not contain a recognized listings table");
    return { postings, rejectedRowCount };
  },
};
