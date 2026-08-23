# Final acceptance audit

This matrix separates locally reproducible acceptance from hosted/private cutover evidence. A local pass is not represented as a production pass.

| Acceptance criterion | State | Evidence or remaining action |
| --- | --- | --- |
| Public repository contains no applicant PII, documents, tokens, production data, dumps, or unsanitized fixtures | Local candidate pass | `docs/public-repo-privacy-audit.md`; repeat against the exact staged set because the Git baseline is currently empty. |
| At least 75 verified employer endpoints across at least four ATS types | Pass | 98/98 active endpoints passed both public API and career-page checks across four ATS types; three unresolved boards remain disabled. |
| Tier A sources are attempted every five minutes when GitHub scheduling runs | Local contract pass; hosted observation open | Workflow/schema validation passes; confirm in three authorized hosted cycles. |
| Three consecutive poll cycles complete without duplicate insertion | Fixture pass; hosted observation open | Phase 3 fixture cycles pass; run three production cycles after provider setup. |
| A supported Tier-A role produces one grouped alert after the next successful workflow | Local atomic/idempotent pass; hosted E2E open | Database/email suites pass; requires an authorized Resend recipient and hosted workflow. |
| Scheduler staleness over 20 minutes produces a visible warning | Pass | Dashboard snapshot shows the warning against sanitized local state. |
| Individual source failures remain isolated and visible | Pass | Poller partial-failure tests and dashboard source/run views. |
| Imported tracker counts/statuses reconcile exactly | Private dry run pass; live apply open | The authorized private snapshot accepted 25 profile/evidence, 123 source, 17 job, and 12 historical-run rows with zero duplicates or rejections. Live apply waits for the real owner identity and server-only credentials. |
| Only the allowlisted owner can access data/documents | Local and hosted schema pass; provider login open | Auth decision tests, 130 database assertions, and the hosted security advisor pass; GitHub OAuth registration/secret entry and the first owner login remain open. |
| RLS covers anonymous, owner, non-owner, and privileged worker contexts | Pass | Full pgTAP suite. |
| Resend retries are duplicate-safe; invalid webhooks cannot mutate; hard failures suppress | Pass locally; provider smoke open | Email and webhook suites pass. |
| Alert HTML/plain text pass template, accessibility, and size checks | Pass | React Email suite. |
| Queue → package → local fill → manual review works for Greenhouse, Lever, and Ashby fixtures | Pass locally; hosted/private package E2E open | Chrome fixture tests prove review-ready with no submit; hosted signed-document flow requires provider/private input. |
| Sensitive or unknown answers stop for input | Pass | Planner/browser and companion lifecycle tests. |
| No automated path can submit an application | Pass | Runtime action types, companion state machine, browser fixtures, and database constraints. |
| Document evals contain no unsupported claims | Pass on sanitized evidence | Preparation eval and rendered anonymous artifact evidence; real CV import remains private. |
| Supabase, Resend, Vercel, and GitHub remain free with fail-closed limits | Local limits pass; hosted billing observation open | Static limits and current official-plan review pass; confirm dashboards after cutover. |
| Google Sheet receives no writes after cutover | Open | The existing daily automation intentionally remains unchanged until three hosted parallel cycles pass; then update it to recovery/source-gap work only and attest `RADAR_SHEET_WRITES_DISABLED=true`. |

## Additional prescribed product capabilities

- Daily fallback digest: capped alerts now coalesce into one deduplicated, future `daily_digest` outbox row with distinct HTML/plain-text subject and copy.
- Realtime dashboard: six owner-scoped tables are published; the browser binds the authenticated token before subscription and debounces server-component refreshes. A local database transition refreshed an open application detail without navigation.
- Encrypted backup: `radar backup` streams a custom-format database export into AES-256-GCM and DPAPI-wraps its key; see `docs/local-encrypted-backup.md`.
- Dashboard/queue browser E2E: sanitized owner login, overview, application board, detail, and a live application-state update passed through the Playwright CLI with zero page errors on the canonical local origin.
- Frontend-library note: the dashboard retains semantic server-rendered tables and native progress meters. TanStack Table/Recharts/shadcn were not added merely to duplicate these simple representations; adding them without a sorting/visualization requirement would increase client JavaScript without improving the acceptance criteria. Tailwind remains used by the React Email template. This is an intentional implementation divergence from the plan's broad stack list, not an acceptance claim.

## Remaining authorized cutover sequence

1. Manually submit the prepared GitHub OAuth registration, enter its returned credentials directly in Supabase, complete the first owner login, and configure Resend/GitHub/Vercel server-only secrets without billing or overage.
2. When the Vercel connector quota resets on 2026-08-27 10:30 America/Toronto, deploy to Hobby; then apply the exact private plan and rerun it idempotently.
3. Observe three hosted cycles and exercise alert, owner login, package, local-fill, pairing, revocation, and manual-review E2E.
4. Update the existing Daily Internship Search automation so it stops Sheet writes and runs recovery/source-gap analysis through authenticated repository commands; create the separate Application Package Preparer heartbeat with no form filling or submission.
5. Disable all remaining Sheet writes, preserve the Sheet unchanged as an archive, run the read-only production validator, and confirm every provider dashboard remains at $0.
