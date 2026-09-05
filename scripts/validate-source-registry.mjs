import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a path`);
  return resolve(value);
}

const registryPath = optionValue("--registry", resolve(import.meta.dirname, "..", "config", "public-source-registry.json"));
const targetsPath = optionValue("--targets", resolve(import.meta.dirname, "..", "config", "target-company-search.json"));
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const targets = JSON.parse(await readFile(targetsPath, "utf8"));
const live = process.argv.includes("--live");
const allowedAts = new Set(["greenhouse", "lever", "ashby", "workday", "smartrecruiters", "hosted_json", "simplify", "secondary", "career_page"]);
const allowedRenderModes = new Set(["http", "browser"]);
const expectedIntervals = { A: 300, B: 1800, C: 86400 };
const requiredTargetCompanies = [
  "Google", "Microsoft", "Amazon", "Apple", "Meta", "NVIDIA", "IBM", "Oracle", "Salesforce", "Adobe", "Cisco", "Intel", "AMD", "Qualcomm", "Tesla",
  "OpenAI", "Anthropic", "Cohere", "Shopify", "Stripe", "Uber", "Airbnb", "Datadog", "Snowflake", "Palantir", "ServiceNow", "Atlassian", "Cloudflare", "MongoDB", "GitHub", "Reddit", "Roblox", "ByteDance", "Block", "Bloomberg",
  "Autodesk", "Thomson Reuters Labs", "RBC Borealis", "Wealthsimple", "Clio", "Waabi", "Kinaxis", "Coveo", "D-Wave", "BlackBerry",
];
const requiredSearchNames = [
  "Google Canada", "Microsoft Canada", "Amazon Canada", "Apple Vancouver", "Meta Toronto", "NVIDIA Toronto", "IBM Canada",
  "TikTok", "Square", "Autodesk Toronto", "Thomson Reuters", "Borealis AI", "QNX", "BlackBerry QNX",
];

if (!registry || typeof registry !== "object" || !Array.isArray(registry.sources)) throw new Error("source registry must contain a sources array");
if (registry.sources.length < 75) throw new Error(`source registry has ${registry.sources.length}; at least 75 are required`);
if (!Array.isArray(registry.disabledSources)) throw new Error("source registry must contain a disabledSources array");

const companyRepositories = new Map();
const endpointKeys = new Set();
for (const [index, source] of registry.sources.entries()) {
  const label = `source ${index + 1}`;
  if (!source || typeof source !== "object") throw new Error(`${label} must be an object`);
  for (const field of ["company", "tier", "careerUrl", "ats", "boardIdentifier", "endpointUrl", "verifiedAt"]) {
    if (typeof source[field] !== "string" || source[field].trim() === "") throw new Error(`${label}.${field} must be a non-empty string`);
  }
  if (!allowedAts.has(source.ats)) throw new Error(`${label}.ats is unsupported`);
  if (source.renderMode !== undefined && !allowedRenderModes.has(source.renderMode)) throw new Error(`${label}.renderMode is unsupported`);
  if (source.ats === "career_page" && source.renderMode === undefined) throw new Error(`${label}.renderMode is required for career_page sources`);
  if (!Object.hasOwn(expectedIntervals, source.tier) || source.intervalSeconds !== expectedIntervals[source.tier]) throw new Error(`${label} has the wrong interval for tier ${source.tier}`);
  if (source.ats === "career_page" && source.intervalSeconds !== 86400) throw new Error(`${label} career_page sources require a daily interval of 86400 seconds`);
  if (!Number.isInteger(source.priority) || source.priority < 0 || source.priority > 100) throw new Error(`${label}.priority is out of range`);
  if (source.active !== true) throw new Error(`${label} must be active or move to a separately reasoned disabled registry`);
  if (!Number.isInteger(source.jobsAtVerification) || source.jobsAtVerification < 1) throw new Error(`${label} lacks non-empty live-verification evidence`);
  if (!source.careerUrl.startsWith("https://") || !source.endpointUrl.startsWith("https://")) throw new Error(`${label} URLs must use HTTPS`);
  if (Number.isNaN(Date.parse(source.verifiedAt))) throw new Error(`${label}.verifiedAt is invalid`);
  const companyKey = source.company.toLowerCase();
  const endpointKey = `${source.ats}:${source.endpointUrl.toLowerCase()}`;
  const registeredCareerUrl = companyRepositories.get(companyKey);
  if (registeredCareerUrl !== undefined && registeredCareerUrl !== source.careerUrl) throw new Error(`${label} duplicates a company with a different repository`);
  if (endpointKeys.has(endpointKey)) throw new Error(`${label} duplicates an ATS board`);
  companyRepositories.set(companyKey, source.careerUrl); endpointKeys.add(endpointKey);
}
for (const [index, source] of registry.disabledSources.entries()) {
  const label = `disabled source ${index + 1}`;
  for (const field of ["company", "ats", "boardIdentifier", "careerUrl", "endpointUrl", "lastCheckedAt", "disabledReason"]) {
    if (typeof source?.[field] !== "string" || source[field].trim() === "") throw new Error(`${label}.${field} must be a non-empty string`);
  }
  if (!allowedAts.has(source.ats) || !source.careerUrl.startsWith("https://") || !source.endpointUrl.startsWith("https://") || Number.isNaN(Date.parse(source.lastCheckedAt))) throw new Error(`${label} is invalid`);
  if (source.renderMode !== undefined && !allowedRenderModes.has(source.renderMode)) throw new Error(`${label}.renderMode is unsupported`);
  const endpointKey = `${source.ats}:${source.endpointUrl.toLowerCase()}`;
  if (endpointKeys.has(endpointKey)) throw new Error(`${label} duplicates an active or disabled ATS board`);
  endpointKeys.add(endpointKey);
}

if (!targets || typeof targets !== "object" || !targets.searchRoutes || typeof targets.searchRoutes !== "object" || Array.isArray(targets.searchRoutes)) {
  throw new Error("target company search must contain a searchRoutes object");
}
if (!Array.isArray(targets.companies)) throw new Error("target company search must contain a companies array");

const routeNames = new Set(Object.keys(targets.searchRoutes));
for (const [routeName, selectors] of Object.entries(targets.searchRoutes)) {
  if (!Array.isArray(selectors) || selectors.length === 0) throw new Error(`search route ${routeName} must select at least one active source`);
  for (const selector of selectors) {
    if (typeof selector?.ats !== "string" || typeof selector?.boardIdentifier !== "string") throw new Error(`search route ${routeName} has an invalid source selector`);
    const found = registry.sources.some((source) => source.ats === selector.ats && source.boardIdentifier.toLowerCase() === selector.boardIdentifier.toLowerCase());
    if (!found) throw new Error(`search route ${routeName} references an inactive or missing source ${selector.ats}:${selector.boardIdentifier}`);
  }
}

const targetNames = new Set();
const searchableNames = new Set();
let activeDirectCoverage = 0;
let disabledDirectCoverage = 0;
for (const [index, company] of targets.companies.entries()) {
  const label = `target company ${index + 1}`;
  if (typeof company?.name !== "string" || company.name.trim() === "") throw new Error(`${label}.name must be a non-empty string`);
  if (![1, 2, 3].includes(company.tier)) throw new Error(`${label}.tier must be 1, 2, or 3`);
  if (!Array.isArray(company.aliases) || company.aliases.some((alias) => typeof alias !== "string" || alias.trim() === "")) throw new Error(`${label}.aliases must contain non-empty strings`);
  if (typeof company.canadaFocus !== "boolean") throw new Error(`${label}.canadaFocus must be boolean`);
  if (!Array.isArray(company.preferredLocations) || company.preferredLocations.some((location) => typeof location !== "string" || location.trim() === "")) throw new Error(`${label}.preferredLocations must contain non-empty strings`);
  if (!Array.isArray(company.searchRoutes) || company.searchRoutes.length === 0) throw new Error(`${label} must have at least one search route`);
  for (const routeName of company.searchRoutes) {
    if (!routeNames.has(routeName)) throw new Error(`${label} references unknown search route ${routeName}`);
  }
  const direct = company.directCoverage;
  if (!direct || typeof direct !== "object" || !["active", "disabled"].includes(direct.state)
    || typeof direct.ats !== "string" || typeof direct.boardIdentifier !== "string") {
    throw new Error(`${company.name} must define valid direct coverage`);
  }
  const collection = direct.state === "active" ? registry.sources : registry.disabledSources;
  const directSource = collection.find((source) => source.company.toLowerCase() === company.name.toLowerCase()
    && source.ats === direct.ats && source.boardIdentifier.toLowerCase() === direct.boardIdentifier.toLowerCase());
  if (directSource === undefined) {
    throw new Error(`${company.name} references a missing ${direct.state === "active" ? "active direct source" : "disabled direct record"}`);
  }
  if (direct.state === "active") activeDirectCoverage += 1;
  else disabledDirectCoverage += 1;
  const companyKey = company.name.trim().toLowerCase();
  if (targetNames.has(companyKey)) throw new Error(`${label} duplicates target company ${company.name}`);
  targetNames.add(companyKey);
  for (const searchableName of [company.name, ...company.aliases]) {
    const searchableKey = searchableName.trim().toLowerCase();
    if (searchableNames.has(searchableKey)) throw new Error(`${label} duplicates searchable company name ${searchableName}`);
    searchableNames.add(searchableKey);
  }
}
for (const company of requiredTargetCompanies) {
  if (!targetNames.has(company.toLowerCase())) throw new Error(`required target company is missing: ${company}`);
}
for (const searchName of requiredSearchNames) {
  if (!searchableNames.has(searchName.toLowerCase())) throw new Error(`required search name is missing: ${searchName}`);
}
if (targets.companies.length !== requiredTargetCompanies.length) throw new Error(`target company search must contain exactly ${requiredTargetCompanies.length} canonical companies`);

const atsCounts = Object.fromEntries([...allowedAts].map((ats) => [ats, registry.sources.filter((source) => source.ats === ats).length]));
if (Object.values(atsCounts).filter((count) => count > 0).length < 4) throw new Error("source registry must cover at least four ATS types");

export function buildLiveRequest(source) {
  const headers = { "User-Agent": "InternshipRadar-EndpointVerifier/1.0" };
  if (source.ats === "greenhouse") return { url: `${source.endpointUrl}?content=false`, init: { headers } };
  if (source.ats === "lever") return { url: source.endpointUrl.includes("mode=json") ? source.endpointUrl : `${source.endpointUrl}?mode=json`, init: { headers } };
  if (source.ats === "ashby" || source.ats === "hosted_json" || source.ats === "secondary" || source.ats === "simplify" || source.ats === "career_page") {
    return { url: source.endpointUrl, init: { headers } };
  }
  if (source.ats === "workday") {
    return {
      url: source.endpointUrl,
      init: {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
      },
    };
  }
  return { url: `${source.endpointUrl}?limit=1&offset=0`, init: { headers } };
}

export function listedJobs(source, payload) {
  if (source.ats === "secondary") {
    if (typeof payload !== "string") return null;
    const rows = payload.split(/\r?\n/u).filter((line) => /^\s*\|/u.test(line) && /https:\/\//u.test(line)
      && !/\|\s*(?:company|employer)\s*\|/iu.test(line) && !/^\s*\|[-:| ]+$/u.test(line));
    return rows;
  }
  if (source.ats === "simplify") return payload;
  if (source.ats === "lever") return payload;
  if (source.ats === "workday") return Array.isArray(payload?.jobPostings) ? payload.jobPostings : null;
  if (source.ats === "hosted_json") return Array.isArray(payload) ? payload : payload?.jobs;
  if (source.ats === "career_page") {
    if (typeof payload !== "string") return null;
    const hasJsonLdJob = /"@type"\s*:\s*(?:"JobPosting"|\[[^\]]*"JobPosting")/iu.test(payload);
    const hasInternshipLink = /<a\b[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?\b(?:intern(?:ship)?|co[\s-]?op|working student|student placement)\b[\s\S]*?<\/a>/iu.test(payload);
    return hasJsonLdJob || hasInternshipLink ? [true] : null;
  }
  if (source.ats === "smartrecruiters") return payload?.content;
  return payload?.jobs;
}

async function boundedFetch(request) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(request.url, {
        ...request.init,
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok || (response.status !== 429 && response.status < 500) || attempt === 2) return response;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === 2) throw error;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200 + Math.floor(Math.random() * 200)));
  }
  throw lastError;
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
          boundedFetch(buildLiveRequest(source)),
          boundedFetch({ url: source.careerUrl, init: { headers: { "User-Agent": "InternshipRadar-EndpointVerifier/1.0" } } }),
        ]);
        if (!careerResponse.ok) { results[index] = { ok: false, careerStatus: careerResponse.status }; continue; }
        if (!response.ok) { results[index] = { ok: false, status: response.status }; continue; }
        const payload = source.ats === "secondary" || source.ats === "career_page" ? await response.text() : await response.json();
        const jobs = listedJobs(source, payload);
        results[index] = { ok: Array.isArray(jobs), status: response.status, careerStatus: careerResponse.status, listedJobs: Array.isArray(jobs) ? jobs.length : null };
      } catch (error) {
        results[index] = { ok: false, reason: error instanceof Error ? error.name : "request-failed" };
      }
    }
  }
  await Promise.all(Array.from({ length: 2 }, worker));
  const failures = results.map((result, index) => ({ result, index })).filter(({ result }) => !result.ok);
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, passed: results.length - failures.length, failed: failures.length, atsCounts, failures: failures.map(({ index, result }) => ({ company: registry.sources[index].company, ats: registry.sources[index].ats, ...result })) }, null, 2)}\n`);
  if (failures.length > 0) process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${targets.companies.length} target companies (${activeDirectCoverage} active direct, ${disabledDirectCoverage} disabled direct) across ${routeNames.size} active search route; validated ${registry.sources.length} active public employer endpoints across ${Object.values(atsCounts).filter((count) => count > 0).length} ATS types (${JSON.stringify(atsCounts)}); ${registry.disabledSources.length} unresolved endpoints remain disabled with reasons.\n`);
}
