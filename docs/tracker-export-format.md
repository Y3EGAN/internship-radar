# Private tracker export format

Create one UTF-8 JSON object with these top-level properties. Use `packages/migration/fixtures/tracker-export.sanitized.json` as a shape-only example. A real snapshot belongs under the ignored `tmp/` directory and must never be committed.

- `exportedAt`: ISO 8601 timestamp with a timezone.
- `profileAndCriteria`: four JSON objects named `targetingCriteria`, `contactPreferences`, `alertSettings`, and `nonContactPreferences`.
- `profileEvidence`: verified résumé/evidence rows with `evidenceType`, `label`, `fact`, `sourceReference`, `verifiedAt`, and optional `expiresAt`.
- `searchSources`: rows with company, `A`/`B`/`C` tier, 0–100 priority, active flag, HTTPS career/endpoint URLs, supported ATS, board identifier, interval from 300–86,400 seconds, optional verification timestamp, and a required reason when inactive.
- `jobs`: rows with title, HTTPS URL, discovered timestamp, optional company/description/location/dates, 0–100 score, status, and a free-form `userTracking` object. Historical `applied`, `submitted`, `interviewing`, `rejected`, and `offer` rows must include both the verified `submittedAt` and `manualSubmissionConfirmedAt` timestamps; the importer will not invent submission confirmation.
- `runLog`: completed historical cycles with start/end timestamps, non-negative counters, outcome, and partition key.

Accepted job statuses are case-insensitive: `discovered`, `new`, `needs verification`, `verified`, `shortlisted`, `saved`, `dismissed`, `skipped`, `closed`, `expired`, `applied`, `submitted`, `interviewing`, `rejected`, `withdrawn`, and `offer`. Any other value is rejected for explicit mapping.

The importer removes URL fragments and common tracking parameters, deduplicates jobs by canonical URL and sources by ATS/board identifier, maps statuses explicitly, and derives deterministic historical run identifiers. It never emits imported content in the reconciliation report.

Dry-run example:

`pnpm migration:plan -- tmp/tracker-export.json --registry config/public-source-registry.json --report tmp/migration-report.json`

Live apply is unavailable until the dry run has zero rejected rows. It additionally requires an exact snapshot fingerprint confirmation and server-only environment credentials, as described in `docs/phase-8-cutover-runbook.md`.
