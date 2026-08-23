# Phase 5 gate evidence

Verified locally on 2026-08-22 with Next.js 16.3.2, Supabase SSR 0.12.4, Supabase JS 2.112.3, and fixture-safe configuration.

## Authentication and private data

- GitHub OAuth begins through the server-side Supabase client and exchanges the callback code on `/auth/callback`; password sign-in remains a local recovery path.
- Every dashboard route calls the same server-only owner gate. Anonymous sessions redirect to `/login`, authenticated non-owners redirect to `/unauthorized`, and the configured owner proceeds with an RLS-scoped client.
- Three unit tests cover owner, non-owner, and anonymous decisions. The Phase 1 pgTAP suite independently proves the matching owner/non-owner/anonymous RLS behavior.
- No service-role client exists in the dashboard. A production-artifact scan checked 48 static browser files and found no service-role, Resend, or database secret token names.
- Private package documents are listed only after owner authorization and receive a server-created storage URL that expires after 60 seconds.

## Dashboard behavior

- The responsive shell exposes overview, jobs, application pipeline, source health, run history, profile, and device routes.
- Jobs support bounded minimum-score, state, and escaped location filters. A stable discovered-at plus ID cursor returns at most 50 records and preserves active filters.
- Applications render as a six-stage pipeline board. Overview metrics include job, application, source, and email backlog counts plus fail-closed daily/monthly email usage meters.
- Source and run tables expose failure counts, due times, outcomes, source totals, discoveries, and durations.

## Gate results

- Web lint passes, all three access tests pass, TypeScript passes, and the optimized production build emits all dashboard, callback, and webhook routes.
- Browser verification at 375, 768, 1024, and 1440 pixels found labeled form controls and meaningful content. At 375px it found no horizontal page overflow, no Next.js error overlay, and zero console errors.
- Focus indicators, semantic headings/labels, 44px controls, text-plus-color states, reduced-motion handling, responsive navigation, and mobile-safe 16px form controls are present.
- The repository privacy scan passes across 154 public candidate files.

Live GitHub provider login and a hosted owner-session visual smoke test require the authorized Supabase/Vercel provider configuration in Phase 8. Local owner authorization is covered by the decision tests and database RLS suite; no external OAuth configuration was changed during this gate.

Phase 8 hardening publishes six owner-owned tables to Supabase Realtime and adds a focused client component that loads the authenticated session before registering owner filters, debounces `router.refresh()`, reports connection state accessibly, and removes its channel on cleanup. Sanitized Playwright CLI E2E covered password owner login, overview, application queue/detail, and a database transition that refreshed the open detail without navigation. The canonical local origin produced zero page errors.

Numeric job cursor encode/decode tests also fixed a boundary mismatch that had rejected database bigint identities as non-UUIDs.
