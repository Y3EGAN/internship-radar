# Phase 2 gate evidence

Verified locally on 2026-08-22 with sanitized fixtures, Supabase CLI 2.115.0, Postgres 17, Node 22.23.2, and pnpm 10.34.5.

## Discovery behavior

- Seven adapters normalize Greenhouse, Lever, Ashby, Workday CXS, SmartRecruiters, hosted JSON, and Simplify secondary-feed payloads.
- Canonical URLs remove tracking parameters, normalized fingerprints are deterministic, and stable ATS IDs take precedence over canonical URL deduplication.
- Fuzzy similarity emits a review warning and never merges records automatically.
- Per-source requests enforce an eight-second default timeout, three bounded attempts, jitter, and `Retry-After` handling.
- One failed source produces a partial run without discarding healthy-source results.
- Deterministic scoring enforces the 30/30/20/10/10 component bounds.

## Atomic persistence

- Four service-role-only RPCs start idempotent runs, atomically upsert jobs/sources/scores/snapshots, record endpoint health and counts, and finish runs as succeeded/partial/failed.
- A clean migration reset applies the initial schema, storage policies, discovery pipeline, and ambiguity correction in order.
- The database test suite passes 58 assertions. Phase 2 coverage proves repeat observations do not duplicate rows, changed hashes create exactly one snapshot, cross-owner writes fail, scores persist, run counts update, and three consecutive failures transition endpoint health from degraded to failing.
- Generated TypeScript database types match the local schema exactly.

## Gate coverage

Sanitized automated tests cover every required gate case:

- successful and empty source payloads;
- changed postings and duplicate stable IDs/canonical URLs;
- HTTP 429 with `Retry-After`, HTTP 5xx, timeout, malformed payload, and terminal 4xx behavior;
- partial failure with healthy-source persistence;
- all-source failure and missing-adapter isolation.

The full privacy scan, project-skill validation, schema validation, lint, strict TypeScript checks, 35 core/poller unit tests, production build, security advisor, and performance advisor gate all pass. Fresh-database unused-index notices remain informational.
