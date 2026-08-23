import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getDashboardSnapshot(client: SupabaseClient) {
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [jobs, priority, applications, failures, latestRun, dueEmail, profile, dailyEmail, monthlyEmail] = await Promise.all([
    client.from("jobs").select("*", { count: "exact", head: true }).eq("state", "discovered"),
    client.from("jobs").select("*", { count: "exact", head: true }).gte("preliminary_score", 80),
    client.from("applications").select("*", { count: "exact", head: true }).in("state", ["queued_for_codex", "preparing", "needs_input"]),
    client.from("source_endpoints").select("*", { count: "exact", head: true }).in("state", ["degraded", "failing"]),
    client.from("source_runs").select("outcome,finished_at,attempted_count,succeeded_count,failed_count").order("started_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("email_outbox").select("*", { count: "exact", head: true }).in("state", ["pending", "retry_wait"]),
    client.from("profiles").select("daily_email_cap,monthly_email_cap,database_soft_limit_mb,storage_soft_limit_mb").maybeSingle(),
    client.from("email_outbox").select("*", { count: "exact", head: true }).not("sent_at", "is", null).gte("sent_at", dayStart),
    client.from("email_outbox").select("*", { count: "exact", head: true }).not("sent_at", "is", null).gte("sent_at", monthStart),
  ]);
  return {
    newJobs: jobs.count ?? 0,
    priorityJobs: priority.count ?? 0,
    queuedApplications: applications.count ?? 0,
    sourceFailures: failures.count ?? 0,
    pendingEmails: dueEmail.count ?? 0,
    latestRun: latestRun.data,
    limits: profile.data,
    dailyEmailSent: dailyEmail.count ?? 0,
    monthlyEmailSent: monthlyEmail.count ?? 0,
  };
}
