import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MigrationPlan } from "./index.js";

type Result = { imported: { profile: number; evidence: number; companies: number; sources: number; jobs: number; applications: number; runs: number } };

function assertServerConfiguration(): { url: string; key: string; ownerId: string } {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerId = process.env.OWNER_USER_ID;
  if (!url || !key || !ownerId) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and OWNER_USER_ID are required for apply");
  if (key.startsWith("NEXT_PUBLIC_") || key.includes("replace-with")) throw new Error("A real server-only service-role key is required");
  return { url, key, ownerId };
}

async function checked<T>(promise: PromiseLike<{ data: T; error: { message: string } | null }>, context: string): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(`${context}: ${error.message}`);
  return data;
}

export async function applyMigrationPlan(plan: MigrationPlan): Promise<Result> {
  if (!plan.reconciliation.reconciledExactly || plan.reconciliation.rejections.length > 0) {
    throw new Error("Apply is blocked until all rows reconcile and every rejection is resolved");
  }
  const { url, key, ownerId } = assertServerConfiguration();
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const imported = { profile: 0, evidence: 0, companies: 0, sources: 0, jobs: 0, applications: 0, runs: 0 };

  await checked(client.from("profiles").upsert({
    owner_id: ownerId,
    targeting_criteria: plan.profile.targetingCriteria,
    contact_preferences: plan.profile.contactPreferences,
    alert_settings: plan.profile.alertSettings,
    non_contact_preferences: plan.profile.nonContactPreferences,
  }, { onConflict: "owner_id" }), "import profile");
  imported.profile = 1;

  if (plan.evidence.length > 0) {
    await checked(client.from("profile_evidence").upsert(plan.evidence.map((item) => ({
      owner_id: ownerId, evidence_type: item.evidenceType, label: item.label, fact: item.fact,
      source_reference: item.sourceReference, verified_at: item.verifiedAt, expires_at: item.expiresAt ?? null,
    })), { onConflict: "owner_id,source_reference,fact" }), "import profile evidence");
    imported.evidence = plan.evidence.length;
  }

  const companyRows = [...new Map(plan.sources.map((source) => [source.company.toLowerCase(), source])).values()].map((source) => ({
    owner_id: ownerId, name: source.company, tier: source.tier, priority: source.priority,
    is_active: source.active, career_url: source.careerUrl,
  }));
  if (companyRows.length > 0) {
    await checked(client.from("companies").upsert(companyRows, { onConflict: "owner_id,name" }), "import companies");
    imported.companies = companyRows.length;
  }
  const companies = await checked(client.from("companies").select("id,name").eq("owner_id", ownerId), "read imported companies");
  const companyIds = new Map((companies as Array<{ id: number; name: string }>).map((row) => [row.name.toLowerCase(), row.id]));

  if (plan.sources.length > 0) {
    await checked(client.from("source_endpoints").upsert(plan.sources.map((source) => ({
      owner_id: ownerId, company_id: companyIds.get(source.company.toLowerCase()) ?? null,
      ats: source.ats, board_identifier: source.boardIdentifier, endpoint_url: source.endpointUrl,
      render_mode: source.renderMode,
      interval_seconds: source.intervalSeconds, state: source.active ? "healthy" : "disabled",
      disabled_reason: source.active ? null : source.disabledReason, verified_at: source.verifiedAt ?? null,
    })), { onConflict: "owner_id,ats,board_identifier" }), "import sources");
    imported.sources = plan.sources.length;
  }

  for (const job of plan.jobs) {
    const companyId = job.company ? companyIds.get(job.company.toLowerCase()) ?? null : null;
    const row = {
      owner_id: ownerId, company_id: companyId, employer_name: job.company ?? "Company not listed", title: job.title,
      normalized_title: job.title.trim().toLowerCase().replace(/\s+/g, " "), canonical_url: job.url,
      description: job.description ?? null, location_text: job.location ?? null,
      normalized_location: job.location?.trim().toLowerCase().replace(/\s+/g, " ") ?? null,
      state: job.jobState, preliminary_score: job.score, posted_at: job.postedAt ?? null,
      closes_at: job.closesAt ?? null, discovered_at: job.discoveredAt,
      last_seen_at: job.lastSeenAt ?? job.discoveredAt,
    };
    const existing = await checked(client.from("jobs").select("id").eq("owner_id", ownerId).eq("canonical_url", job.url).maybeSingle(), "look up job");
    let jobId: number;
    if (existing) {
      jobId = (existing as { id: number }).id;
      await checked(client.from("jobs").update(row).eq("id", jobId).eq("owner_id", ownerId), "update job");
    } else {
      const inserted = await checked(client.from("jobs").insert(row).select("id").single(), "insert job");
      jobId = (inserted as { id: number }).id;
    }
    imported.jobs += 1;
    if (job.applicationState) {
      await checked(client.from("applications").upsert({
        owner_id: ownerId, job_id: jobId, state: job.applicationState,
        submitted_at: job.submittedAt ?? null,
        manual_submission_confirmed_at: job.manualSubmissionConfirmedAt ?? null,
        notes: Object.keys(job.userTracking).length > 0 ? `Imported tracker fields: ${JSON.stringify(job.userTracking)}` : null,
      }, { onConflict: "owner_id,job_id" }), "import application tracking");
      imported.applications += 1;
    }
  }

  if (plan.runs.length > 0) {
    await checked(client.from("source_runs").upsert(plan.runs.map((run) => ({
      owner_id: ownerId, workflow_run_id: run.workflowRunId, partition_key: run.partitionKey,
      started_at: run.startedAt, finished_at: run.finishedAt, duration_ms: run.durationMs,
      attempted_count: run.attemptedCount, succeeded_count: run.succeededCount, failed_count: run.failedCount,
      discovered_count: run.discoveredCount, changed_count: run.changedCount, outcome: run.outcome,
    })), { onConflict: "owner_id,workflow_run_id,partition_key" }), "import run log");
    imported.runs = plan.runs.length;
  }
  return { imported };
}

export function createServiceClientForTest(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
