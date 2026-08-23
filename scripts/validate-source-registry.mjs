import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const registryPath = resolve(import.meta.dirname, "..", "config", "public-source-registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const live = process.argv.includes("--live");
const allowedAts = new Set(["greenhouse", "lever", "ashby", "smartrecruiters"]);
const expectedIntervals = { A: 300, B: 1800, C: 86400 };

if (!registry || typeof registry !== "object" || !Array.isArray(registry.sources)) throw new Error("source registry must contain a sources array");
if (registry.sources.length < 75) throw new Error(`source registry has ${registry.sources.length}; at least 75 are required`);
if (!Array.isArray(registry.disabledSources)) throw new Error("source registry must contain a disabledSources array");

const companyKeys = new Set();
const endpointKeys = new Set();
for (const [index, source] of registry.sources.entries()) {
  const label = `source ${index + 1}`;
  if (!source || typeof source !== "object") throw new Error(`${label} must be an object`);
  for (const field of ["company", "tier", "careerUrl", "ats", "boardIdentifier", "endpointUrl", "verifiedAt"]) {
    if (typeof source[field] !== "string" || source[field].trim() === "") throw new Error(`${label}.${field} must be a non-empty string`);
  }
  if (!allowedAts.has(source.ats)) throw new Error(`${label}.ats is unsupported`);
  if (!Object.hasOwn(expectedIntervals, source.tier) || source.intervalSeconds !== expectedIntervals[source.tier]) throw new Error(`${label} has the wrong interval for tier ${source.tier}`);
  if (!Number.isInteger(source.priority) || source.priority < 0 || source.priority > 100) throw new Error(`${label}.priority is out of range`);
  if (source.active !== true) throw new Error(`${label} must be active or move to a separately reasoned disabled registry`);
  if (!Number.isInteger(source.jobsAtVerification) || source.jobsAtVerification < 1) throw new Error(`${label} lacks non-empty live-verification evidence`);
  if (!source.careerUrl.startsWith("https://") || !source.endpointUrl.startsWith("https://")) throw new Error(`${label} URLs must use HTTPS`);
  if (Number.isNaN(Date.parse(source.verifiedAt))) throw new Error(`${label}.verifiedAt is invalid`);
  const companyKey = source.company.toLowerCase();
  const endpointKey = `${source.ats}:${source.boardIdentifier.toLowerCase()}`;
  if (companyKeys.has(companyKey)) throw new Error(`${label} duplicates a company`);
  if (endpointKeys.has(endpointKey)) throw new Error(`${label} duplicates an ATS board`);
  companyKeys.add(companyKey); endpointKeys.add(endpointKey);
}
for (const [index, source] of registry.disabledSources.entries()) {
  const label = `disabled source ${index + 1}`;
  for (const field of ["company", "ats", "boardIdentifier", "careerUrl", "endpointUrl", "lastCheckedAt", "disabledReason"]) {
    if (typeof source?.[field] !== "string" || source[field].trim() === "") throw new Error(`${label}.${field} must be a non-empty string`);
  }
  if (!allowedAts.has(source.ats) || !source.careerUrl.startsWith("https://") || !source.endpointUrl.startsWith("https://") || Number.isNaN(Date.parse(source.lastCheckedAt))) throw new Error(`${label} is invalid`);
  const endpointKey = `${source.ats}:${source.boardIdentifier.toLowerCase()}`;
  if (endpointKeys.has(endpointKey)) throw new Error(`${label} duplicates an active or disabled ATS board`);
  endpointKeys.add(endpointKey);
}

const atsCounts = Object.fromEntries([...allowedAts].map((ats) => [ats, registry.sources.filter((source) => source.ats === ats).length]));
if (Object.values(atsCounts).filter((count) => count > 0).length < 4) throw new Error("source registry must cover at least four ATS types");

function liveUrl(source) {
  if (source.ats === "greenhouse") return `${source.endpointUrl}?content=false`;
  if (source.ats === "lever") return source.endpointUrl.includes("mode=json") ? source.endpointUrl : `${source.endpointUrl}?mode=json`;
  if (source.ats === "ashby") return source.endpointUrl;
  return `${source.endpointUrl}?limit=1&offset=0`;
}

function listedJobs(source, payload) {
  if (source.ats === "lever") return payload;
  if (source.ats === "smartrecruiters") return payload?.content;
  return payload?.jobs;
}

if (live) {
  const results = new Array(registry.sources.length);
  let cursor = 0;
  async function worker() {
    while (cursor < registry.sources.length) {
      const index = cursor++;
      const source = registry.sources[index];
      try {
        const [response, careerResponse] = await Promise.all([
          fetch(liveUrl(source), { headers: { "User-Agent": "InternshipRadar-EndpointVerifier/1.0" }, signal: AbortSignal.timeout(8000) }),
          fetch(source.careerUrl, { headers: { "User-Agent": "InternshipRadar-EndpointVerifier/1.0" }, signal: AbortSignal.timeout(8000) }),
        ]);
        if (!careerResponse.ok) { results[index] = { ok: false, careerStatus: careerResponse.status }; continue; }
        if (!response.ok) { results[index] = { ok: false, status: response.status }; continue; }
        const jobs = listedJobs(source, await response.json());
        results[index] = { ok: Array.isArray(jobs), status: response.status, careerStatus: careerResponse.status, listedJobs: Array.isArray(jobs) ? jobs.length : null };
      } catch (error) {
        results[index] = { ok: false, reason: error instanceof Error ? error.name : "request-failed" };
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  const failures = results.map((result, index) => ({ result, index })).filter(({ result }) => !result.ok);
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, passed: results.length - failures.length, failed: failures.length, atsCounts, failures: failures.map(({ index, result }) => ({ company: registry.sources[index].company, ats: registry.sources[index].ats, ...result })) }, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${registry.sources.length} active public employer endpoints across ${Object.values(atsCounts).filter((count) => count > 0).length} ATS types (${JSON.stringify(atsCounts)}); ${registry.disabledSources.length} unresolved endpoints remain disabled with reasons.\n`);
}
