import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "..");
const validatorPath = join(repositoryRoot, "scripts", "validate-source-registry.mjs");
const registryPath = join(repositoryRoot, "config", "public-source-registry.json");
const targetsPath = join(repositoryRoot, "config", "target-company-search.json");
const requestedCompanies = [
  "Google", "Microsoft", "Amazon", "Apple", "Meta", "NVIDIA", "IBM", "Oracle", "Salesforce", "Adobe", "Cisco", "Intel", "AMD", "Qualcomm", "Tesla",
  "OpenAI", "Anthropic", "Cohere", "Shopify", "Stripe", "Uber", "Airbnb", "Datadog", "Snowflake", "Palantir", "ServiceNow", "Atlassian", "Cloudflare", "MongoDB", "GitHub", "Reddit", "Roblox", "ByteDance", "Block", "Bloomberg",
  "Autodesk", "Thomson Reuters Labs", "RBC Borealis", "Wealthsimple", "Clio", "Waabi", "Kinaxis", "Coveo", "D-Wave", "BlackBerry",
];

const validatorModule = await import("./validate-source-registry.mjs");

function runValidator(...args) {
  return spawnSync(process.execPath, [validatorPath, ...args], { encoding: "utf8" });
}

test("the source gate validates all 45 requested company searches", () => {
  const result = runValidator("--registry", registryPath, "--targets", targetsPath);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated 45 target companies/u);
});

test("the source gate rejects a target company without a search route", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-targets-"));
  try {
    const targets = {
      searchRoutes: { "broad-internship-feeds": [{ ats: "simplify", boardIdentifier: "SimplifyJobs/Summer2027-Internships:dev:listings.json" }] },
      companies: requestedCompanies.map((name) => ({ name, tier: 1, aliases: [], canadaFocus: false, preferredLocations: [], searchRoutes: ["broad-internship-feeds"] })),
    };
    targets.companies[0].searchRoutes = [];
    const fixturePath = join(fixtureDirectory, "targets.json");
    writeFileSync(fixturePath, `${JSON.stringify(targets)}\n`);

    const result = runValidator("--registry", registryPath, "--targets", fixturePath);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /search route/u);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("the source gate rejects removal of a requested company alias", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-aliases-"));
  try {
    const targets = JSON.parse(readFileSync(targetsPath, "utf8"));
    targets.companies.find((company) => company.name === "ByteDance").aliases = [];
    const fixturePath = join(fixtureDirectory, "targets.json");
    writeFileSync(fixturePath, `${JSON.stringify(targets)}\n`);

    const result = runValidator("--registry", registryPath, "--targets", fixturePath);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required search name is missing: TikTok/u);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("live request construction uses the Workday adapter contract", () => {
  const request = validatorModule.buildLiveRequest({
    ats: "workday",
    endpointUrl: "https://example.wd5.myworkdayjobs.com/wday/cxs/example/ExampleCareers/jobs",
  });
  assert.equal(request.url, "https://example.wd5.myworkdayjobs.com/wday/cxs/example/ExampleCareers/jobs");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), { appliedFacets: {}, limit: 20, offset: 0, searchText: "" });
});

test("live payload recognition covers Workday and careers-page responses", () => {
  assert.equal(validatorModule.listedJobs({ ats: "workday" }, { jobPostings: [{ title: "Intern" }] }).length, 1);
  assert.equal(validatorModule.listedJobs({ ats: "workday" }, { jobs: [] }), null);
  assert.equal(validatorModule.listedJobs(
    { ats: "career_page" },
    '<script type="application/ld+json">{"@type":"JobPosting","title":"Software Intern"}</script>',
  ).length, 1);
  assert.equal(validatorModule.listedJobs({ ats: "career_page" }, "<html><p>No openings</p></html>"), null);
});

test("the source gate rejects an invalid careers-page render mode", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-render-mode-"));
  try {
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    registry.sources[0] = {
      ...registry.sources[0],
      ats: "career_page",
      boardIdentifier: "example-careers-render-mode",
      endpointUrl: "https://careers.example.invalid/jobs",
      renderMode: "interactive",
      tier: "C",
      intervalSeconds: 86400,
    };
    const fixturePath = join(fixtureDirectory, "registry.json");
    writeFileSync(fixturePath, `${JSON.stringify(registry)}\n`);
    const result = runValidator("--registry", fixturePath, "--targets", targetsPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /renderMode/u);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("the source gate requires a daily interval for careers pages", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-career-interval-"));
  try {
    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    registry.sources[0] = {
      ...registry.sources[0],
      ats: "career_page",
      boardIdentifier: "example-careers-interval",
      endpointUrl: "https://careers.example.invalid/jobs",
      renderMode: "browser",
      tier: "B",
      intervalSeconds: 1800,
    };
    const fixturePath = join(fixtureDirectory, "registry.json");
    writeFileSync(fixturePath, `${JSON.stringify(registry)}\n`);
    const result = runValidator("--registry", fixturePath, "--targets", targetsPath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /career_page.*86400|daily interval/iu);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("the source gate rejects a target without direct coverage", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-direct-missing-"));
  try {
    const targets = JSON.parse(readFileSync(targetsPath, "utf8"));
    delete targets.companies.find((company) => company.name === "Google").directCoverage;
    const fixturePath = join(fixtureDirectory, "targets.json");
    writeFileSync(fixturePath, `${JSON.stringify(targets)}\n`);
    const result = runValidator("--registry", registryPath, "--targets", fixturePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Google.*direct coverage/iu);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("the source gate rejects a missing active direct source", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-direct-active-"));
  try {
    const targets = JSON.parse(readFileSync(targetsPath, "utf8"));
    targets.companies.find((company) => company.name === "OpenAI").directCoverage.boardIdentifier = "missing-openai-board";
    const fixturePath = join(fixtureDirectory, "targets.json");
    writeFileSync(fixturePath, `${JSON.stringify(targets)}\n`);
    const result = runValidator("--registry", registryPath, "--targets", fixturePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /OpenAI.*active direct source/iu);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});

test("the source gate rejects a missing disabled direct record", () => {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "internship-radar-direct-disabled-"));
  try {
    const targets = JSON.parse(readFileSync(targetsPath, "utf8"));
    targets.companies.find((company) => company.name === "Google").directCoverage.boardIdentifier = "missing-google-record";
    const fixturePath = join(fixtureDirectory, "targets.json");
    writeFileSync(fixturePath, `${JSON.stringify(targets)}\n`);
    const result = runValidator("--registry", registryPath, "--targets", fixturePath);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Google.*disabled direct record/iu);
  } finally {
    rmSync(fixtureDirectory, { recursive: true, force: true });
  }
});
