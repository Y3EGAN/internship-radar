# Phase 1 gate evidence

Verified locally on 2026-08-22 with Supabase CLI 2.115.0, Postgres 17, Node 22.23.2, and pnpm 10.34.5.

## Declarative schema

- Seven ordered declarative schema groups are the source of truth for 19 private application tables, enums, constraints, indexes, lifecycle triggers, retention logic, RLS, storage policies, and grants.
- The CLI generated `20260823000036_initial_schema.sql` with strict pg-delta coverage.
- Because pg-delta intentionally omits policies on the platform-managed `storage.objects` table, the CLI's migra engine generated `20260823000655_storage_policies.sql` from the same declarative storage-policy source.
- A clean local reset applied both generated migrations and the sanitized seed without error.
- The local migration list shows both versions applied in order.

## Policy and constraint tests

All 34 pgTAP assertions pass across three files. They cover:

- RLS enabled and forced on all 19 exposed application tables;
- anonymous denial, owner isolation, non-owner isolation, and privileged-worker access;
- separate storage SELECT, INSERT, UPDATE, and DELETE policies;
- score component bounds and generated total;
- valid and invalid application lifecycle transitions;
- append-only application events;
- required cursor, partial, and unique indexes;
- least-privilege anonymous grants and the retention helper.

## Advisors and generated types

- The security advisor reports no issues.
- The performance advisor reports no warnings or errors; fresh-database unused-index notices are informational and expected before runtime traffic.
- Generated TypeScript database types match the local `public` schema byte-for-byte after newline normalization.
- The repository privacy scan, schema contract validator, lint, strict TypeScript checks, unit tests, and production build pass after the database changes.
