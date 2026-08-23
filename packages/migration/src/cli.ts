import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applyMigrationPlan } from "./apply.js";
import { buildMigrationPlan, countsOnlyReport, mergePublicSourceRegistry } from "./index.js";

function usage(): never {
  throw new Error("Usage: pnpm migration:plan -- <private-export.json> [--registry <public-source-registry.json>] [--report <counts-report.json>] [--apply]");
}

const args = process.argv.slice(2);
const inputArg = args.find((arg) => !arg.startsWith("--"));
if (!inputArg) usage();
const reportIndex = args.indexOf("--report");
const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : undefined;
if (reportIndex >= 0 && !reportPath) usage();
const apply = args.includes("--apply");
const registryIndex = args.indexOf("--registry");
const registryArg = registryIndex >= 0 ? args[registryIndex + 1] : undefined;
if (registryIndex >= 0 && !registryArg) usage();
const invocationDirectory = process.env.INIT_CWD ?? process.cwd();

const inputPath = resolve(invocationDirectory, inputArg);
let raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
if (registryArg) {
  const registry = JSON.parse(await readFile(resolve(invocationDirectory, registryArg), "utf8")) as unknown;
  raw = mergePublicSourceRegistry(raw, registry);
}
const plan = buildMigrationPlan(raw);
const digest = createHash("sha256").update(JSON.stringify(plan)).digest("hex");
const report = { ...countsOnlyReport(plan), planFingerprint: digest };

if (reportPath) await writeFile(resolve(invocationDirectory, reportPath), `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (apply) {
  const expected = `APPLY:${digest}`;
  if (process.env.RADAR_MIGRATION_APPLY_CONFIRM !== expected) {
    throw new Error(`Live apply refused. Set RADAR_MIGRATION_APPLY_CONFIRM to APPLY:<the printed plan fingerprint> for this exact snapshot.`);
  }
  const result = await applyMigrationPlan(plan);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
