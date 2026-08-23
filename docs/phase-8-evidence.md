# Phase 8 evidence — authorized rollout in progress

Repository-side work was verified locally on 2026-08-22 and the authorized provider/private rollout was advanced on 2026-08-23. Local verification used Node 22.23.2, pnpm 10.34.5, Supabase CLI 2.115.0, Postgres 17, and sanitized fixtures.

## Implemented

- `apps/web/vercel.json` defines the Next.js monorepo build, exact-lock installation, and post-build browser secret scan without configuring a Vercel cron.
- `scripts/validate-deployment-readiness.mjs` performs 28 static deployment checks. Its optional production mode is read-only, requires explicit plan/Sheet attestations, and checks 75 active verified endpoints, four ATS types, three successful cycles, canonical duplicates, sent alerts, and manual-review applications.
- `config/public-source-registry.json` contains 98 active public employer boards across Greenhouse, Lever, Ashby, and SmartRecruiters. `scripts/validate-source-registry.mjs --live` independently checks both the ATS API schema and public career page; three unresolved boards are retained only in the disabled registry with sanitized reasons.
- Broad employer boards are filtered to explicit internship, co-op, working-student, or student-placement signals before persistence, and Greenhouse verification avoids full-description payloads to protect free-tier storage and runtime budgets.
- Daily-cap overflow coalesces into one durable fallback digest; the dashboard has authenticated Realtime refresh; `radar backup` creates an AES-256-GCM database export with a DPAPI-wrapped key; and numeric job pagination cursors match the database identity type.
- The migration workspace accepts a strict private JSON snapshot, validates HTTPS/timestamps/ranges, canonicalizes URLs, maps statuses explicitly, deduplicates stable keys, derives deterministic historical run IDs, and accounts for every Profile & Criteria, Search Sources, Jobs, and Run Log row.
- Reconciliation output is counts-only. Live apply refuses rejections and requires `APPLY:<sha256 plan fingerprint>` plus server-only credentials for that exact snapshot.
- The importer is idempotent across profile, evidence, companies, sources, jobs, application tracking, and historical runs. No applicant content is emitted to its report.
- `docs/free-tier-verification.md`, `docs/tracker-export-format.md`, and `docs/phase-8-cutover-runbook.md` document current provider constraints, private data handling, the three-cycle observation window, Sheet write retirement, and rollback.
- A root `.vercelignore` excludes private snapshots, local browser state, documents, dumps, environment files, and repository-only evidence from deployment upload.
- Two companion functions now use invoker security; anonymous execution is explicitly revoked and authenticated-owner policies/grants are tested.

## Verification results

- Static deployment readiness: 28/28 checks passed.
- Public source registry: 98/98 active endpoints passed live API and career-page verification across four ATS types on 2026-08-22 (America/Toronto); 53 Greenhouse, 2 Lever, 26 Ashby, and 17 SmartRecruiters boards passed.
- Migration suite: 7/7 tests passed, including public registry merge, exact accounting for accepted, duplicate, and rejected rows, plus refusal to invent historical submission confirmation.
- Authorized private migration dry run: 25 profile/evidence rows, 123 source rows after registry merge, 17 jobs, and 12 historical runs were accepted with zero duplicates and zero rejections.
- Repository gate: privacy scan (230 public candidates), four project-skill validations, schema/workflow/source validation, lint, typecheck, and 87 default package tests passed.
- Production build: all nine workspaces built; Next generated 18 pages/routes and the browser scan passed across 50 static artifacts.
- Clean local database reset applied all fourteen migrations and sanitized seed.
- Database gate: 130/130 pgTAP assertions passed, generated database types matched, the security advisor reported no issues, and the performance advisor reported only expected unused-index information on the fresh database.
- Opt-in Windows gate: all 16 local-agent tests passed, including DPAPI backup/token tests and three real-Chrome ATS fixtures.
- Sanitized browser E2E: owner login, dashboard, application queue/detail, connected Realtime state, and an automatic server-driven state refresh passed with no page errors on the canonical origin.

## Authorized provider and private-data evidence

- A Supabase Free project was created in `ca-central-1`, all fourteen migrations were applied, and the hosted project is healthy.
- Hosted advisor review exposed overly broad executable privileges on two companion functions. They now use invoker security, anonymous execution is explicitly revoked, authenticated-owner table policies are present, and the hosted security advisor is clear.
- The private tracker and CV were read only for the authorized migration. The exact counts-only plan fingerprint is retained in ignored local storage for the fail-closed apply; no applicant content or credential is recorded here.
- A GitHub OAuth application form is prepared in the authenticated browser with the Supabase callback. Registration and returned-secret entry remain deliberate manual dashboard actions.
- A production Vercel deployment was attempted through the authorized connector, but the connector quota is unavailable until 2026-08-27 10:30 America/Toronto. No paid-plan workaround was used.

## Open hosted cutover gate

No deployment or email has occurred, provider secrets have not been exposed to the repository or chat, the private plan has not been applied without a real owner identity, and no local device has been paired. The following authoritative gate conditions remain unverified:

- configure GitHub OAuth, create the allowlisted owner by signing in once, and enter server-only credentials directly in provider dashboards;
- apply the exact private plan in production and rerun it idempotently;
- three consecutive hosted parallel cycles without duplicates;
- hosted alert, owner auth, package, local-fill/manual-review, and pairing/revocation E2E;
- permanent cessation of Google Sheet writes with the Sheet preserved as an archive;
- post-cutover confirmation that Supabase, Resend, Vercel, and GitHub all remain at $0.

Phase 8 therefore remains in progress. Completed Supabase and dry-run evidence must not be represented as a completed production cutover.
