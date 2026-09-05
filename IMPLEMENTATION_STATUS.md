# Implementation status

This checklist maps directly to the authoritative Phase 0-8 implementation plan. A phase is complete only when its gate has reproducible evidence.

| Phase | Status | Gate evidence |
| --- | --- | --- |
| 0 - Safety and repository bootstrap | Complete | See `docs/phase-0-evidence.md`; local CI-equivalent checks and production build pass with Node 22/pnpm 10. |
| 1 - Supabase local foundation | Complete | See `docs/phase-1-evidence.md`; clean reset, 34 Phase 1 pgTAP assertions, advisors, and generated-type drift check pass. |
| 2 - Core discovery pipeline | Complete | See `docs/phase-2-evidence.md`; all required fixture cases, atomic persistence, 58 total pgTAP assertions, and repository gates pass. |
| 3 - GitHub Actions scheduler | Complete | See `docs/phase-3-evidence.md`; three fixture cycles, failure isolation, overlap/stale-lock recovery, workflow validation, and all gates pass. |
| 4 - Durable email alerts | Complete | See `docs/phase-4-evidence.md`; atomic/duplicate-safe sending and delivered/bounce/complaint/invalid-signature gates pass. |
| 5 - Authenticated dashboard | Complete | See `docs/phase-5-evidence.md`; owner gating, filters/cursors, pipeline, usage, signed URLs, browser checks, and bundle scanning pass. |
| 6 - Codex package preparation | Complete | See `docs/phase-6-evidence.md`; truthful lifecycle, private APIs/artifacts, render QA, accessibility, and eval gates pass. |
| 7 - Local Playwright agent | Complete | See `docs/phase-7-evidence.md`; pairing, DPAPI, durable queue, Chrome fixtures, pause/review, and no-submit gates pass. |
| 8 - Migration, deployment, and cutover | In progress | See `docs/phase-8-evidence.md`; production deployment, OAuth, migration, source import, and hosted polling evidence are complete. Alert/application E2E, idempotent re-apply, Sheet retirement, and final free-tier attestation remain open. |

## Phase 0 checklist

- [x] Establish a pnpm/TypeScript monorepo layout.
- [x] Pin Node and pnpm major versions and exact package versions.
- [x] Add public-repository ignore rules and sanitized sample configuration.
- [x] Add and validate the four project skills.
- [x] Add CI for lint, typecheck, unit tests, privacy scanning, and production build.
- [x] Add dependency maintenance and security workflows.
- [x] Generate a lockfile with Node 22 / pnpm 10.
- [x] Pass a clean public-repository privacy scan and all local checks.
- [x] Review the complete public-candidate surface for PII, secrets, unsafe logs, and public artifacts.

Gate evidence: `docs/phase-0-evidence.md`.

## Phase 1 checklist

- [x] Initialize and pin the current Supabase CLI after inspecting live help and current documentation.
- [x] Add ordered declarative schema sources and two CLI-generated migrations.
- [x] Implement 19 private tables, enums, constraints, lifecycle rules, and retention helpers.
- [x] Index every foreign key and ownership predicate plus required cursor and partial query paths.
- [x] Enable and force RLS across all exposed application tables.
- [x] Add least-privilege grants and separate owner storage policies for all replacement operations.
- [x] Test anonymous, owner, non-owner, and privileged-worker contexts.
- [x] Pass a clean local reset and all 34 pgTAP assertions.
- [x] Pass security and performance advisors with no warnings or errors.
- [x] Generate TypeScript database types and verify zero schema drift.

Gate evidence: `docs/phase-1-evidence.md`.

## Phase 2 checklist

- [x] Normalize postings, locations, content, and canonical HTTPS URLs deterministically.
- [x] Implement the bounded 30/30/20/10/10 scoring model.
- [x] Implement Greenhouse, Lever, Ashby, Workday, SmartRecruiters, hosted JSON, and Simplify adapters.
- [x] Add bounded retries, jitter, `Retry-After`, timeouts, and sanitized failure classifications.
- [x] Deduplicate by stable source identity and canonical URL; keep fuzzy matching review-only.
- [x] Persist jobs, source observations, changed snapshots, scores, source health, and run outcomes atomically.
- [x] Restrict poller RPCs to the service role and test owner mismatches.
- [x] Cover success, empty, changed, duplicate, 429, 5xx, timeout, malformed, partial, and total-failure fixtures.
- [x] Pass the full repository, database, generated-type, advisor, and production-build gates.

Gate evidence: `docs/phase-2-evidence.md`.

## Phase 3 checklist

- [x] Add the exact five-minute schedule and manual recovery trigger.
- [x] Enforce minimal permissions, immutable action pins, no artifacts, and a four-minute workflow timeout.
- [x] Enforce a separate three-minute internal deadline and eight-second source requests.
- [x] Partition sources by stable endpoint hash and enforce per-domain concurrency.
- [x] Prevent overlap in both Actions and the database; recover stale killed runs safely.
- [x] Persist healthy-source results and sanitized partial/failed outcomes independently.
- [x] Add a 20-minute staleness predicate and an operational recovery runbook.
- [x] Complete three consecutive fixture cycles without duplicate rows while one source fails.
- [x] Pass workflow validation, 67 database assertions, all repository checks, and the production build.

Gate evidence: `docs/phase-3-evidence.md`. Hosted dispatch is reserved for the authorized Phase 8 provider smoke test.

## Phase 4 checklist

- [x] Atomically group newly verified priority jobs into a durable outbox row.
- [x] Add exclusive claims, stale recovery, suppression checks, and fail-closed daily/monthly caps.
- [x] Coalesce cap-deferred priority matches into one deduplicated daily fallback digest.
- [x] Render one typed, accessible PriorityJobsEmail as HTML and plain text below 102KB.
- [x] Send with deterministic Resend idempotency and explicit `{ data, error }` inspection.
- [x] Retry only network, 429, and server failures with durable backoff.
- [x] Verify raw-body webhooks before writes and process duplicate events idempotently.
- [x] Update delivered/bounced/complained/delayed/suppressed state and suppress hard failures.
- [x] Pass 86 database assertions, 8 email tests, all repository checks, advisors, and production build.

Gate evidence: `docs/phase-4-evidence.md`. Provider delivery and client visual smoke tests remain in authorized Phase 8.

## Phase 5 checklist

- [x] Add GitHub OAuth initiation/callback plus a recovery password path.
- [x] Enforce one server-only owner allowlist across every private route.
- [x] Add the overview, jobs, applications, sources, runs, profile, and devices routes.
- [x] Add bounded filters and stable cursor pagination for the jobs list.
- [x] Add an application pipeline board, source/run health, and fail-closed email usage meters.
- [x] Add authenticated owner-scoped Supabase Realtime refresh for jobs, applications, runs, sources, email state, and devices.
- [x] Exercise sanitized Playwright E2E across owner login, overview, application queue/detail, and a realtime state transition.
- [x] Create 60-second owner-scoped signed URLs for private package documents.
- [x] Verify owner/non-owner/anonymous access decisions and matching database RLS behavior.
- [x] Pass web lint, typecheck, unit tests, production build, privacy scan, and static browser-bundle secret scan.
- [x] Verify labeled meaningful output and responsive behavior at 375, 768, 1024, and 1440 pixels with no mobile overflow, overlay, or console errors.

Gate evidence: `docs/phase-5-evidence.md`. Live GitHub provider login is reserved for authorized Phase 8 configuration.

## Phase 6 checklist

- [x] Require an explicit owner action, verified source, and no duplicate before queueing.
- [x] Add exclusive Codex claims and atomic package-ready/needs-input transitions.
- [x] Enforce verified, unexpired evidence IDs and reject unsupported terms and metrics.
- [x] Stop contextual and never-infer questions for application-specific confirmation.
- [x] Generate cover letters only when required or explicitly selected.
- [x] Add server-only authenticated claim, package, and failure APIs.
- [x] Keep DOCX/PDF artifacts in the private owner/application storage path and clean partial uploads.
- [x] Build, metadata-scrub, rasterize, visually inspect, and accessibility-audit an anonymous evidence-bound DOCX fixture.
- [x] Pass 8 preparation evals, 3 builder tests, 5 web tests, 103 database assertions, type drift, advisors, production build, privacy, and browser-bundle scans.

Gate evidence: `docs/phase-6-evidence.md`.

## Phase 7 checklist

- [x] Add ten-minute one-time pairing codes and hash-only 90-day device tokens.
- [x] Add owner revocation and immediate revoked/expired-token rejection.
- [x] Encrypt the local token with current-user Windows DPAPI and keep data under `%LOCALAPPDATA%`.
- [x] Add a durable atomic local queue plus status/resume and an AES-256-GCM database backup whose key is Windows-DPAPI protected.
- [x] Use installed Chrome with a dedicated persistent profile.
- [x] Fill safe labeled fields and upload the approved private resume before other fields.
- [x] Support Greenhouse, Lever, and Ashby fixture flows; pause Workday, SmartRecruiters, and iCIMS as assisted flows.
- [x] Pause login, CAPTCHA, sensitive, ambiguous, and unknown required cases.
- [x] Prohibit final submission in browser actions, companion events, and database state transitions.
- [x] Pass 11 default agent tests, 3 real-Chrome fixtures, 2 DPAPI encryption tests, 20 companion assertions, the 128-assertion full database suite, production build, security/type/bundle/privacy gates, and direct DPAPI round-trips.

Gate evidence: `docs/phase-7-evidence.md`.

## Phase 8 checklist

- [x] Add Vercel monorepo configuration with a frozen install, scoped Next build, and browser-bundle secret scan.
- [x] Verify current Supabase, Resend, Vercel, and GitHub free-tier behavior against official provider documentation.
- [x] Add a static deployment-readiness validator and a read-only hosted acceptance mode.
- [x] Add a private tracker export contract, deterministic transformer, counts-only reconciliation report, and fail-closed idempotent importer.
- [x] Cover canonicalization, status mapping, duplicates, rejections, evidence deduplication, and complete row accounting with sanitized tests.
- [x] Document provider setup, private résumé/evidence import, parallel validation, cutover, and rollback.
- [x] Obtain explicit authorization for Supabase, Vercel, GitHub, Resend, GitHub OAuth, and provider configuration.
- [x] Create the Supabase Free production project in Canada, apply all migrations, harden companion-function privileges, and resolve all actionable hosted security-advisor findings. The remaining leaked-password warning describes a feature unavailable on Free.
- [x] Live-verify at least 75 public employer endpoints across at least four ATS types (98 active endpoints across four ATS types passed both API and career-page checks; three unresolved boards remain disabled).
- [x] Import and reconcile the 98 verified public employer endpoints in the authorized production project.
- [x] Dry-run the real private Sheet/CV snapshot with zero rejected rows and exact source/destination reconciliation; retain only an ignored private snapshot and counts-only report locally.
- [x] Apply the exact approved private plan after owner OAuth and server-only credentials are configured; live counts reconcile to 1 profile, 24 evidence rows, 123 sources, 17 imported jobs plus discovered jobs, and 12 historical runs plus hosted runs.
- [ ] Rerun the exact approved private plan to record explicit idempotency evidence.
- [x] Run at least three successful hosted cycles with no canonical or source-identity duplicate groups.
- [ ] Complete hosted alert/application E2E, device pairing/revocation, and the read-only production gate.
- [ ] Disable all Google Sheet writes and preserve the Sheet unchanged as an archive.
- [ ] Confirm every provider remains at $0 after cutover.

Current evidence: `docs/phase-8-evidence.md`. The Phase 8 gate is intentionally open.

## Target-company direct discovery extension

- [x] Preserve the existing broad North America internship-feed route for all 45 requested companies.
- [x] Link every target to an active direct source or a dated disabled record.
- [x] Add 14 newly verified direct sources, bringing target direct coverage to 25 active and 20 disabled.
- [x] Add Workday public POST validation and correct its enforced 20-row request limit.
- [x] Add deterministic careers-page parsing for JobPosting JSON-LD and internship links.
- [x] Add bounded HTTP-to-Chromium fallback, heavy-resource blocking, failure isolation, and guaranteed cleanup.
- [x] Keep the five-minute workflow cadence, three-minute internal deadline, two-per-domain concurrency, overlap guard, and four-minute workflow timeout unchanged.
- [x] Pass the 117-of-117 bounded live endpoint gate on 2026-09-05.

Inventory: `docs/target-company-direct-coverage.md`.

## External actions reserved for Phase 8

Authorization has been granted. Supabase provisioning, GitHub OAuth owner login, public repository publication, Vercel production deployment, private migration apply, source import, and hosted polling are complete. Resend delivery/webhook validation, application/package/local-agent E2E, explicit migration re-apply evidence, Google Sheet cutover, and final provider-plan attestation remain open.
