import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const production = process.argv.includes("--production");
const reportIndex = process.argv.indexOf("--report");
const reportPath = reportIndex >= 0 ? process.argv[reportIndex + 1] : undefined;
if (reportIndex >= 0 && !reportPath) throw new Error("--report requires a path");

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass, detail });
const read = (path) => readFile(resolve(root, path), "utf8");

const [envExample, workflow, config, schema, packageJson, vercel, sourceRegistry] = await Promise.all([
  read(".env.example"), read(".github/workflows/poll.yml"), read("supabase/config.toml"),
  read("supabase/schemas/01_tables.sql"), read("package.json").then(JSON.parse),
  read("apps/web/vercel.json").then(JSON.parse),
  read("config/public-source-registry.json").then(JSON.parse),
]);

const requiredKeys = [
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SITE_URL",
  "OWNER_USER_ID", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CODEX_PREPARATION_TOKEN",
  "RESEND_API_KEY", "RESEND_WEBHOOK_SECRET", "ALERT_RECIPIENT", "RADAR_EMAIL_FROM",
  "RADAR_DASHBOARD_URL", "RADAR_EMAIL_DAILY_CAP", "RADAR_EMAIL_MONTHLY_CAP",
  "RADAR_DATABASE_SOFT_LIMIT_MB", "RADAR_STORAGE_SOFT_LIMIT_MB",
];
for (const key of requiredKeys) {
  const occurrences = [...envExample.matchAll(new RegExp(`^${key}=`, "gm"))].length;
  add(`env-example:${key}`, occurrences === 1, occurrences === 1 ? "declared once" : `declared ${occurrences} times`);
}

add("workflow:five-minute-offset", workflow.includes('cron: "2/5 * * * *"'), "expected 2/5 schedule");
add("workflow:standard-public-runner", workflow.includes("runs-on: ubuntu-latest") && !workflow.includes("larger-runner"), "standard GitHub-hosted runner only");
add("workflow:no-production-artifacts", !/actions\/upload-artifact|pull_request_target/.test(workflow), "no artifact upload or pull_request_target");
add("workflow:bounded", workflow.includes("timeout-minutes: 4") && workflow.includes("cancel-in-progress: false"), "four-minute timeout and serialized cycles");
add("schema:free-email-caps", /daily_email_cap between 1 and 50/.test(schema) && /monthly_email_cap between 1 and 2500/.test(schema), "below Resend Free limits");
add("schema:resource-soft-limits", /database_soft_limit_mb between 1 and 400/.test(schema) && /storage_soft_limit_mb between 1 and 800/.test(schema), "below Supabase Free limits");
add("schema:all-function-sources", ["03_preparation_functions.sql", "03_companion_functions.sql"].every((name) => config.includes(name)), "preparation and companion schemas included");
add("runtime:pinned", packageJson.packageManager === "pnpm@10.34.5" && packageJson.engines?.node === ">=22 <23", "Node 22 and pnpm 10");
add("vercel:next-monorepo", vercel.framework === "nextjs" && vercel.installCommand.includes("--frozen-lockfile") && vercel.buildCommand.includes("verify-browser-bundle.mjs"), "locked install, scoped build, bundle secret scan");
add("vercel:no-cron", !Object.hasOwn(vercel, "crons"), "GitHub owns five-minute scheduling");
add("sources:minimum-verified", Array.isArray(sourceRegistry.sources) && sourceRegistry.sources.length >= 75 && sourceRegistry.sources.every((source) => source.jobsAtVerification > 0), `${sourceRegistry.sources?.length ?? 0} non-empty verified endpoints`);
add("sources:ats-diversity", new Set(sourceRegistry.sources?.map((source) => source.ats)).size >= 4, `${new Set(sourceRegistry.sources?.map((source) => source.ats)).size} ATS types`);

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Production verification requires ${name}`);
  return value;
}

async function rest(path, url, serviceKey) {
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Production read failed with HTTP ${response.status}`);
  return response.json();
}

if (production) {
  const url = requiredEnv("SUPABASE_URL");
  const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const ownerId = requiredEnv("OWNER_USER_ID");
  if (!/^https:\/\//.test(url)) throw new Error("SUPABASE_URL must use HTTPS");
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) throw new Error("OWNER_USER_ID must be a UUID");
  for (const [name, expected] of [["RADAR_SUPABASE_PLAN", "free"], ["RADAR_RESEND_PLAN", "free"], ["RADAR_VERCEL_PLAN", "hobby"], ["RADAR_GITHUB_REPOSITORY_VISIBILITY", "public"], ["RADAR_SHEET_WRITES_DISABLED", "true"]]) {
    add(`attestation:${name}`, process.env[name]?.toLowerCase() === expected, `must equal ${expected}`);
  }
  const encodedOwner = encodeURIComponent(ownerId);
  const [sources, runs, jobs, emails, applications] = await Promise.all([
    rest(`source_endpoints?select=ats,verified_at,state&owner_id=eq.${encodedOwner}`, url, serviceKey),
    rest(`source_runs?select=outcome,started_at,discovered_count&owner_id=eq.${encodedOwner}&order=started_at.desc&limit=3`, url, serviceKey),
    rest(`jobs?select=canonical_url&owner_id=eq.${encodedOwner}&canonical_url=not.is.null`, url, serviceKey),
    rest(`email_outbox?select=state&owner_id=eq.${encodedOwner}&state=in.(sent,delivered)`, url, serviceKey),
    rest(`applications?select=state&owner_id=eq.${encodedOwner}&state=eq.ready_for_review`, url, serviceKey),
  ]);
  const verified = sources.filter((source) => source.verified_at && source.state !== "disabled");
  add("production:verified-sources", verified.length >= 75, `${verified.length} active verified endpoints`);
  add("production:ats-diversity", new Set(verified.map((source) => source.ats)).size >= 4, `${new Set(verified.map((source) => source.ats)).size} ATS types`);
  add("production:three-cycles", runs.length === 3 && runs.every((run) => run.outcome === "succeeded"), `${runs.filter((run) => run.outcome === "succeeded").length}/3 latest cycles succeeded`);
  const urls = jobs.map((job) => job.canonical_url);
  add("production:no-canonical-duplicates", new Set(urls).size === urls.length, `${urls.length - new Set(urls).size} duplicate canonical URLs`);
  add("production:alert-flow", emails.length > 0, `${emails.length} sent or delivered outbox rows`);
  add("production:application-flow", applications.length > 0, `${applications.length} applications reached manual review`);
}

const report = { mode: production ? "production-read-only" : "static", generatedAt: new Date().toISOString(), pass: checks.every((check) => check.pass), checks };
if (reportPath) await writeFile(resolve(reportPath), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
