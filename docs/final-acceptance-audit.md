# Final acceptance audit

This matrix separates locally reproducible acceptance from hosted/private cutover evidence. A local pass is not represented as a production pass.

| Acceptance criterion | State | Evidence or remaining action |
| --- | --- | --- |
| Public repository contains no applicant PII, documents, tokens, production data, dumps, or unsanitized fixtures | Pass | CI public-repository safety checks and the local semantic/regex privacy review pass against the published repository. |
| At least 75 verified employer endpoints across at least four ATS types | Pass | 98/98 active endpoints passed both public API and career-page checks across four ATS types; three unresolved boards remain disabled. |
| Tier A sources are attempted every five minutes when GitHub scheduling runs | Pass with documented GitHub timing limitation | The workflow contract passes and hosted runs are persisted. GitHub schedule delays remain best-effort and are surfaced by the 20-minute warning. |
| Three consecutive poll cycles complete without duplicate insertion | Pass | More than three hosted cycles succeeded; production has zero canonical-URL and source-identity duplicate groups. |
| A supported Tier-A role produces one grouped alert after the next successful workflow | Delivery pass; webhook completion open | A controlled production priority alert was sent once and delivered. Update the mismatched Vercel webhook secret and replay the delivery event to complete persisted delivery-state proof. |
| Scheduler staleness over 20 minutes produces a visible warning | Pass | Dashboard snapshot shows the warning against sanitized local state. |
| Individual source failures remain isolated and visible | Pass | Poller partial-failure tests and dashboard source/run views. |
| Imported tracker counts/statuses reconcile exactly | Live apply pass; explicit re-apply evidence open | Production has 1 profile plus 24 evidence rows, 123 sources, and the imported jobs/runs followed by hosted discovery. Counts match the zero-rejection private report; rerun the exact plan once more to record idempotency. |
| Only the allowlisted owner can access data/documents | Pass | Auth decision/RLS tests pass; production has one GitHub identity and an active owner session. The private `application-documents` bucket and four owner-scoped object policies are present. |
| RLS covers anonymous, owner, non-owner, and privileged worker contexts | Pass | Full pgTAP suite. |
| Resend retries are duplicate-safe; invalid webhooks cannot mutate; hard failures suppress | Pass locally; provider replay open | Email and webhook suites pass; the invalid-signature production attempts correctly made no writes. Replace the mismatched Vercel secret and replay to prove the valid provider path. |
| Alert HTML/plain text pass template, accessibility, and size checks | Pass | React Email suite. |
| Queue → package → local fill → manual review works for Greenhouse, Lever, and Ashby fixtures | Pass locally; hosted/private package E2E open | Chrome fixture tests prove review-ready with no submit; hosted signed-document flow requires provider/private input. |
| Sensitive or unknown answers stop for input | Pass | Planner/browser and companion lifecycle tests. |
| No automated path can submit an application | Pass | Runtime action types, companion state machine, browser fixtures, and database constraints. |
| Document evals contain no unsupported claims | Pass on sanitized evidence | Preparation eval and rendered anonymous artifact evidence; real CV import remains private. |
| Supabase, Resend, Vercel, and GitHub remain free with fail-closed limits | Current official limits and local controls pass; hosted billing observation open | Official limits were rechecked on 2026-08-23 and remain compatible with the internal caps; confirm dashboards after cutover. |
| Google Sheet receives no writes after cutover | Open | The existing daily automation intentionally remains unchanged until three hosted parallel cycles pass; then update it to recovery/source-gap work only and attest `RADAR_SHEET_WRITES_DISABLED=true`. |

The hosted Supabase organization is confirmed Free and the project is healthy. Its sole current security-advisor warning is leaked-password protection, which Supabase lists as unavailable on Free; enabling a paid plan solely to clear that warning would violate the $0 acceptance criterion.

## Additional prescribed product capabilities

- Daily fallback digest: capped alerts now coalesce into one deduplicated, future `daily_digest` outbox row with distinct HTML/plain-text subject and copy.
- Realtime dashboard: six owner-scoped tables are published; the browser binds the authenticated token before subscription and debounces server-component refreshes. A local database transition refreshed an open application detail without navigation.
- Encrypted backup: `radar backup` streams a custom-format database export into AES-256-GCM and DPAPI-wraps its key; see `docs/local-encrypted-backup.md`.
- Dashboard/queue browser E2E: sanitized owner login, overview, application board, detail, and a live application-state update passed through the Playwright CLI with zero page errors on the canonical local origin.
- Frontend-library note: the dashboard retains semantic server-rendered tables and native progress meters. TanStack Table/Recharts/shadcn were not added merely to duplicate these simple representations; adding them without a sorting/visualization requirement would increase client JavaScript without improving the acceptance criteria. Tailwind remains used by the React Email template. This is an intentional implementation divergence from the plan's broad stack list, not an acceptance claim.

## Remaining authorized cutover sequence

1. Rerun the exact approved private plan to record explicit idempotency evidence.
2. Configure/verify Resend and exercise one grouped alert plus delivery/webhook state.
3. Exercise package, local-fill, pairing, revocation, and manual-review E2E.
4. Update the existing Daily Internship Search automation so it stops Sheet writes and runs recovery/source-gap analysis through authenticated repository commands; create the separate Application Package Preparer heartbeat with no form filling or submission.
5. Disable all remaining Sheet writes, preserve the Sheet unchanged as an archive, run the read-only production validator, and confirm every provider dashboard remains at $0.
