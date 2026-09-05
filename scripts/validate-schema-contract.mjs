import { readFileSync } from "node:fs";

const read = (file) => readFileSync(file, "utf8");
const tables = read("supabase/schemas/01_tables.sql");
const indexes = read("supabase/schemas/02_indexes.sql");
const functions = read("supabase/schemas/03_functions.sql");
const policies = read("supabase/schemas/04_policies.sql");
const storage = ["select", "insert", "update", "delete"]
  .map((operation) => read(`supabase/schemas/05_storage_${operation}.sql`))
  .join("\n");
const grants = read("supabase/schemas/06_grants.sql");

const requiredTables = [
  "profiles", "profile_evidence", "companies", "source_endpoints", "source_runs",
  "jobs", "job_sources", "job_snapshots", "job_scores", "applications",
  "application_packages", "screening_answers", "application_events", "email_outbox",
  "email_deliveries", "resend_webhook_events", "email_suppressions", "device_pairings",
  "device_tokens", "link_verifications",
];

for (const table of requiredTables) {
  if (!tables.includes(`create table public.${table}`)) throw new Error(`missing table: ${table}`);
  if (!policies.includes(`'${table}'`)) throw new Error(`missing RLS registration: ${table}`);
}

const invariants = [
  [indexes, "jobs_owner_state_cursor_idx"],
  [indexes, "jobs_owner_saved_idx"],
  [indexes, "applications_owner_state_cursor_idx"],
  [indexes, "source_endpoints_due_idx"],
  [indexes, "email_outbox_due_idx"],
  [functions, "validate_application_state_transition"],
  [functions, "delete_expired_data"],
  [storage, "application_documents_owner_insert"],
  [storage, "application_documents_owner_update"],
  [grants, "revoke all on all tables in schema public from anon, authenticated"],
];

for (const [source, invariant] of invariants) {
  if (!source.includes(invariant)) throw new Error(`missing schema invariant: ${invariant}`);
}

if (/security\s+definer/iu.test(functions)) throw new Error("SECURITY DEFINER is forbidden in Phase 1 functions");
if (/auth\.uid\(\)\s*=\s*owner_id/iu.test(policies)) {
  throw new Error("RLS auth.uid() calls must use a scalar subquery for plan caching");
}

console.log(`Validated ${requiredTables.length} tables and Phase 1 schema invariants.`);
