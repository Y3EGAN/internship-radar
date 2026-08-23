# Phase 8 cutover runbook

This runbook separates repository-safe preparation from user-authorized provider changes. Never paste secrets into a terminal transcript, report, issue, commit, or chat.

## 1. Static preflight

1. Run the full repository and database gates.
2. Run `pnpm deployment:validate` and retain the counts-only result locally.
3. Confirm the Vercel project is personal/non-commercial and every selected provider plan is Free/Hobby at $0.
4. Confirm no billing method, paid trial, overage, larger Actions runner, or paid add-on is enabled.

## 2. Provider setup (explicit authorization required)

1. Create or select one Supabase Free project. Record its region and confirm the dashboard says Free before pushing migrations.
2. Configure the owner account and GitHub OAuth callback. Keep password fallback owner-only.
3. Configure a Vercel Hobby project with repository root directory `apps/web`. The checked-in configuration performs a frozen monorepo install, builds only the web app, and runs the browser-bundle secret scan.
4. Add server-only values only to the production environment; add `NEXT_PUBLIC_*` values only where explicitly browser-safe.
5. Configure Resend Free with one verified recipient/domain and one webhook. Never log a full API key or webhook secret.
6. Add the poller secrets to GitHub Actions, keep the repository public, and manually dispatch once before relying on the schedule.

## 3. Private tracker and résumé migration

1. Export the four Sheet tabs to one private JSON snapshot following `docs/tracker-export-format.md`. Keep the export under the ignored `tmp/` path.
2. Add the current CV facts to `profileEvidence` only after each claim is verified against the CV or another named source. Do not infer dates, metrics, eligibility, or skills.
3. Run `pnpm migration:plan -- <private-export.json> --registry config/public-source-registry.json --report <ignored-counts-report.json>` so the 98 independently verified public employer endpoints are merged into the private snapshot.
4. Resolve every rejection. The report accounts for accepted, duplicate, and rejected rows but contains no imported content.
5. For an authorized apply, copy the printed plan fingerprint and set `RADAR_MIGRATION_APPLY_CONFIRM=APPLY:<fingerprint>` only for that command. The importer also requires the server-only Supabase URL, service-role key, and owner UUID. It refuses any snapshot with a rejection.
6. Re-run the same snapshot to prove idempotency, then compare destination counts and statuses against the source report.
7. Upload the verified base résumé privately through the owner dashboard; never add it to this repository.

## 4. Parallel validation and cutover

1. Leave the Sheet automation unchanged while three daily production cycles run in parallel.
2. For each cycle, record only counts, timestamps, provider state, and sanitized errors. Confirm no duplicate canonical URL, isolated source failures, one grouped alert for the controlled smoke role, and visible scheduler health.
3. Exercise queue → Codex package → local Greenhouse/Lever/Ashby fill → manual review. Confirm no Submit control is activated.
4. Pair the local agent with a one-time code, confirm its token is DPAPI-protected, then revoke a test pairing and confirm access fails.
5. Run the production read-only gate with provider attestations:

   `node scripts/validate-deployment-readiness.mjs --production --report <ignored-production-report.json>`

6. Only after all gates pass, explicitly disable Sheet writes. Set the Sheet automation read-only/off, note the cutover timestamp outside the public repository, preserve the Sheet unchanged as an archive, and set `RADAR_SHEET_WRITES_DISABLED=true` for the final validator run.
7. Update the existing Daily Internship Search automation to run recovery searches, canonical verification, score explanation, and source-gap analysis through authenticated repository commands without Sheet writes. Create the separate Application Package Preparer heartbeat; neither automation may fill forms or submit applications.

## Rollback

If a gate fails, keep or restore the Sheet automation as the source of truth, disable the GitHub poll workflow, revoke local device tokens, and leave imported rows intact for diagnosis. Do not delete source data or the archive. Fix locally, repeat a controlled import if needed, and restart the three-cycle observation window.
