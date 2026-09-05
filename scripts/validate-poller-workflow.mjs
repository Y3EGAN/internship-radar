import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/poll.yml", "utf8").replace(/\r\n/gu, "\n");
const required = [
  'cron: "2/5 * * * *"',
  "workflow_dispatch:",
  "permissions:\n  contents: read",
  "group: internship-radar-poller",
  "cancel-in-progress: false",
  "timeout-minutes: 4",
  "RADAR_PARTITION_COUNT:",
  "RADAR_PER_DOMAIN_CONCURRENCY:",
];

for (const invariant of required) {
  if (!workflow.includes(invariant)) throw new Error(`Poller workflow invariant is missing: ${invariant}`);
}
if (workflow.includes("pull_request_target") || workflow.includes("actions/upload-artifact")) {
  throw new Error("Poller workflow contains a forbidden trigger or runtime artifact upload");
}

const uses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)].map((match) => match[1]);
if (uses.length === 0 || uses.some((action) => !/@[a-f0-9]{40}$/u.test(action ?? ""))) {
  throw new Error("Every poller workflow action must be pinned to an immutable 40-character commit SHA");
}

console.log("Validated GitHub Actions poller invariants.");
