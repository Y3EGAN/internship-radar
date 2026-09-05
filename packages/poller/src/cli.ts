import { createChromiumFetch } from "./browser-fetch";
import { PostgrestPollerDatabase } from "./postgrest";
import { runSchedulerCycle } from "./scheduler";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") throw new Error(`missing required environment: ${name}`);
  return value;
}

function positiveIntegerEnvironment(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) throw new Error(`invalid positive integer environment: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const ownerId = requiredEnvironment("OWNER_USER_ID");
  const database = new PostgrestPollerDatabase(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
  );
  const workflowRunId = `${requiredEnvironment("GITHUB_RUN_ID")}.${process.env.GITHUB_RUN_ATTEMPT ?? "1"}`;
  const [sources, scoringProfile] = await Promise.all([
    database.listDueSources(ownerId),
    database.loadScoringProfile(ownerId),
  ]);
  const chromium = sources.some((source) => source.renderMode === "browser")
    ? await createChromiumFetch()
    : undefined;
  try {
    const result = await runSchedulerCycle({
      client: database,
      ownerId,
      workflowRunId,
      sources,
      scoringProfile,
      ...(chromium === undefined ? {} : { renderFetchImpl: chromium.fetch }),
      alertRecipient: requiredEnvironment("ALERT_RECIPIENT"),
      partitionCount: positiveIntegerEnvironment("RADAR_PARTITION_COUNT", 8),
      perDomainConcurrency: positiveIntegerEnvironment("RADAR_PER_DOMAIN_CONCURRENCY", 2),
      deadlineMs: 180_000,
    });
    process.stdout.write(`${JSON.stringify({
      status: result.status,
      attempted: result.attempted,
      succeeded: result.succeeded,
      failed: result.failed,
      discovered: result.discovered,
      changed: result.changed,
    })}\n`);
    if (result.status === "failed") process.exitCode = 1;
  } finally {
    await chromium?.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error && error.message.startsWith("missing required environment")
    ? error.message
    : "poller terminated before completing its recorded cycle";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
