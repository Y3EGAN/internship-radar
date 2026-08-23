# Phase 4 gate evidence

Verified locally on 2026-08-22 with Resend 6.22.0, React Email 6.9.2, sanitized provider test addresses, Supabase CLI 2.115.0, and Node 22.23.2.

## Durable outbox and sender

- A verified newly discovered job scoring at least 80 is atomically added to a run-grouped outbox row in the same RPC transaction as job persistence.
- Owner/event uniqueness and exclusive `sending` claims prevent duplicate sends; stale claims recover after ten minutes.
- Daily and monthly caps fail closed by deferring due work, and suppressed recipients are never claimed.
- The scheduled workflow drains the outbox even after a failed discovery step.
- Every Resend request includes HTML, plain text, and the durable logical event key as its idempotency key.
- The sender explicitly inspects `{ data, error }`; only network failures, rate limits, API failures, and concurrent identical requests retry. Validation/auth/domain/idempotency conflicts fail terminally.

## Template and webhooks

- `PriorityJobsEmail` uses typed props/PreviewProps, one 600px container, pixel-based Tailwind, semantic H1/H2 hierarchy, descriptive links, explicit language/direction, 4.5:1-safe colors, styled borders, and a box-border button.
- Render tests prove HTML remains below 102KB and contains no flex, grid, media queries, dark selectors, SVG, or WEBP. A useful plain-text alternative is generated from the same component.
- `POST /api/webhooks/resend` reads raw text, maps the three Svix headers into the current Resend verifier API, and makes no database call on an invalid signature.
- Unique event IDs make delivery events idempotent. Delivered, delayed, bounced, complained, and suppressed states are supported; hard bounces and complaints immediately create indefinite suppression entries.

## Gate results

- The database suite passes 86 assertions, including one atomic alert row, duplicate claim denial, durable retry, delivered update, duplicate webhook denial, hard-bounce suppression, and complaint suppression.
- Eight email tests cover structure/plain text, successful idempotent send, transient retry, terminal failure, transport retry, valid raw webhook processing, and invalid-signature no-write behavior.
- Tests use `delivered@resend.dev`, `bounced@resend.dev`, and `complained@resend.dev`; no invented real-provider address is used.
- Generated types match, security advisors report no issues, performance advisors report only fresh-database informational notices, the privacy/lint/typecheck/unit gate passes, and the Next.js production build includes the dynamic webhook route.

Actual provider delivery and visual client smoke tests require the Phase 8 Resend/Vercel authorization and verified recipient/domain configuration. No email was sent during the local gate.

Phase 8 hardening added the requested fallback digest: when a daily or monthly cap is reached, all due priority/digest job IDs are deduplicated into one future `daily_digest` row and the original rows become non-sendable. The renderer uses distinct transactional subject/copy while retaining the same accessible HTML/plain-text contract. Four new pgTAP assertions and one sender test pass.
