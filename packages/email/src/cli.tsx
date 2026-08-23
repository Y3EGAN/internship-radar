import { Resend } from "resend";
import { sendClaimedEmail, type ClaimedEmail, type PriorityJobEmailItem } from "./index";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") throw new Error(`missing required environment: ${name}`);
  return value;
}

const projectUrl = required("SUPABASE_URL");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY");
const ownerId = required("OWNER_USER_ID");

async function databaseRequest(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(new URL(`/rest/v1/${path}`, projectUrl), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error("email database operation failed");
  return response.json();
}

async function rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
  return databaseRequest(`rpc/${name}`, args);
}

function jobIds(payload: unknown): readonly number[] {
  if (typeof payload !== "object" || payload === null) return [];
  const ids = (payload as { job_ids?: unknown }).job_ids;
  return Array.isArray(ids) ? ids.filter((id): id is number => Number.isInteger(id) && id > 0) : [];
}

async function loadJobs(ids: readonly number[]): Promise<readonly PriorityJobEmailItem[]> {
  if (ids.length === 0) return [];
  const query = new URLSearchParams({
    select: "id,title,location_text,preliminary_score,canonical_url,companies(name)",
    owner_id: `eq.${ownerId}`,
    id: `in.(${ids.join(",")})`,
    order: "preliminary_score.desc,id.asc",
  });
  const rows = await databaseRequest(`jobs?${query.toString()}`) as ReadonlyArray<{
    title: string; location_text: string | null; preliminary_score: number; canonical_url: string;
    companies: { name: string } | readonly { name: string }[] | null;
  }>;
  function companyName(value: { name: string } | readonly { name: string }[] | null): string {
    if (value === null) return "Employer";
    if (Array.isArray(value)) return (value as readonly { name: string }[])[0]?.name ?? "Employer";
    return (value as { name: string }).name;
  }
  return rows.map((row) => ({
    title: row.title,
    company: companyName(row.companies),
    location: row.location_text ?? "",
    score: Number(row.preliminary_score),
    url: row.canonical_url,
    reason: "This verified role crossed your saved priority threshold.",
  }));
}

async function main(): Promise<void> {
  const claims = await rpc("claim_email_outbox", { p_owner_id: ownerId, p_limit: 10 }) as ReadonlyArray<{
    outbox_id: number; logical_event_key: string; message_type: "priority_jobs" | "daily_digest"; recipient: string; payload: unknown;
  }>;
  const resend = new Resend(required("RESEND_API_KEY"));
  let sent = 0;
  let deferred = 0;
  for (const claim of claims) {
    const jobs = await loadJobs(jobIds(claim.payload));
    if (jobs.length === 0) {
      await rpc("record_email_failure", { p_outbox_id: claim.outbox_id, p_retryable: false, p_error_code: "empty_job_payload" });
      continue;
    }
    const email: ClaimedEmail = {
      outboxId: claim.outbox_id,
      logicalEventKey: claim.logical_event_key,
      recipient: claim.recipient,
      jobs,
      messageType: claim.message_type,
    };
    const result = await sendClaimedEmail(resend, {
      async recordSent(outboxId, resendMessageId) {
        await rpc("record_email_send", { p_outbox_id: outboxId, p_resend_message_id: resendMessageId });
      },
      async recordFailure(outboxId, retryable, errorCode) {
        await rpc("record_email_failure", { p_outbox_id: outboxId, p_retryable: retryable, p_error_code: errorCode });
      },
    }, email, { from: required("RADAR_EMAIL_FROM"), dashboardUrl: required("RADAR_DASHBOARD_URL") });
    if (result === "sent") sent += 1;
    else deferred += 1;
  }
  process.stdout.write(`${JSON.stringify({ claimed: claims.length, sent, deferred })}\n`);
}

main().catch(() => {
  process.stderr.write("email sender terminated with a sanitized failure\n");
  process.exitCode = 1;
});
