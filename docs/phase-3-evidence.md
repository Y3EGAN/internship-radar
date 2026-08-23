# Phase 3 gate evidence

Verified locally on 2026-08-22 with fixture-only scheduler cycles, Supabase CLI 2.115.0, Node 22.23.2, pnpm 10.34.5, and tsx 4.23.12.

## Scheduler invariants

- `.github/workflows/poll.yml` uses cron `2/5 * * * *`, `workflow_dispatch`, one non-cancelling concurrency group, read-only contents permission, a four-minute job timeout, and immutable action SHAs.
- Runtime discovery has an independent three-minute deadline, stable SHA-256 endpoint partitions, two-request per-domain concurrency, eight-second source timeouts, and bounded retries.
- The workflow installs the frozen lockfile and uploads no artifacts.
- A repository validator fails CI if the cron, dispatch trigger, permissions, concurrency, timeout, immutable pins, or artifact prohibition drift.

## Database overlap and recovery

- A partial unique index permits only one running source cycle per owner.
- The service-role-only `try_start_source_run` RPC skips concurrent claims.
- A run older than five minutes is atomically marked failed with a sanitized recovery message before a new claim, preventing a killed four-minute workflow from wedging future cycles.
- pgTAP verifies permissions, owner-independent locks, overlapping skips, normal release, and stale-run recovery.

## Gate cycles and diagnostics

- One automated fixture test runs three consecutive scheduler cycles with a healthy Greenhouse source and a failing Lever source.
- All three cycles finish `partial`, persist the healthy source, and retain exactly one stable job row without duplicates.
- Tests also verify stable partition assignment, per-domain concurrency, overlap skips, and the prominent-warning predicate after 20 minutes without a successful run.
- The operations runbook documents GitHub schedule limitations, `gh workflow enable poll.yml`, manual dispatch, run inspection, and the prohibition on paid recovery or runtime artifacts.

The clean database verification passes 67 assertions, generated types match, security advisors report no issues, performance advisors report only expected fresh-database informational notices, all 43 core/poller tests pass, and the full repository check and production build pass. A hosted workflow smoke test requires Phase 8 repository secrets and deployment authorization; no external provider state was changed during this local gate.
