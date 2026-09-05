# GitHub secondary-source cutover runbook

This runbook activates the five public repository companies and six moving-branch endpoints only after repository-safe validation. It does not authorize a production mutation by itself.

## Expected inventory

- Five repository companies: Canadian Tech Internships, Simplify Summer 2027, Vansh Summer 2027, SpeedyApply, and Zapply Canada 2027.
- Six unique endpoints: one per repository except SpeedyApply, which has U.S. and international Markdown feeds.
- 104 active endpoints if all prior 98 employer endpoints still pass. The checked-in inventory has 103 because the pre-existing Temporal Technologies API returned HTTP 404 and was disabled; all six new repository endpoints passed.

## Preflight

1. Run `pnpm sources:validate`, `pnpm sources:verify-live`, `pnpm schema:validate`, the poller tests, database reset/tests/type checks, `pnpm privacy:scan`, `pnpm workflow:validate`, and `pnpm check` on Node 22 with pnpm 10.
2. Confirm the live report says all six new feeds are nonempty and recognized. Move any endpoint that fails verification to `disabledSources` with `lastCheckedAt` and a sanitized reason; do not count it as active.
3. Run a fixture-only scheduler cycle covering all six feed shapes. Confirm partial-row isolation, canonical deduplication, no snapshot reconciliation after partial or failed parses, and bounded runtime.
4. Generate a counts-only migration plan. Expect five new companies and six new endpoints. Expect 104 active endpoints only if all prior 98 remain valid; the checked-in registry currently has 103 because Temporal Technologies is disabled. Record only counts and the printed fingerprint; never commit owner identifiers or credentials.

## Authorized activation

1. Obtain explicit approval for the production apply and confirm the exact migration-plan fingerprint.
2. Apply the database migration before importing registry rows. Confirm `jobs.employer_name`, `job_sources.is_active`, the owner-scoped link cache, and reconciliation RPC exist.
3. Import the registry using the fingerprint-confirmed migration workflow. Do not edit existing source rows outside these six endpoint identifiers.
4. Observe the first poll. Unchecked or failed employer links must remain `needs_verification`; only final public 2xx destinations may become `verified`. Confirm at most 50 expired/new links are checked, redirects remain bounded, and no priority alert is created from an unverified row.
5. Record counts only: source outcomes, accepted/rejected rows, link-cache outcomes, active/inactive source links, deduplicated jobs, and elapsed time. Inspect logs for secrets, applicant data, full payloads, and unsafe URLs.

## Rollback

Disable only the six endpoint identifiers listed in `config/public-source-registry.json`. Leave jobs, source observations, snapshots, and verification-cache rows intact for diagnosis. Existing 98 sources and primary-source authority remain untouched. Fix and re-run all preflight gates before re-enabling an endpoint.

## Target-company direct sources

The target-company extension is additive to these six repository endpoints. The current registry contains 25 active direct target sources and 20 disabled direct records. A direct-source failure must not remove or disable the Simplify or secondary repository feeds.

To recover one broken direct source:

1. Move only that source from `sources` to `disabledSources`, retaining its company, ATS, board identifier, public URLs, check time, and a sanitized reason.
2. Change only that company's `directCoverage.state` to `disabled`; keep `searchRoutes` unchanged.
3. Run `pnpm sources:test`, `pnpm sources:validate`, and `pnpm sources:verify-live`.
4. Trigger **Poll internship sources** manually and confirm broad sources still succeed.

Do not copy HTML, payloads, screenshots, cookies, browser profiles, applicant data, or credentials into logs or the registry.
