# Target-company direct discovery implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verified direct ATS or daily careers-page coverage for all 45 target companies while retaining the existing broad internship feeds.

**Architecture:** The existing poller keeps its source registry, scheduling, isolation, and deduplication flow. New `career_page` sources use an HTML adapter with an optional Chromium fallback, while existing ATS adapters handle discovered public endpoints. The target-company registry links each company to an active direct source or a dated disabled record and keeps broad-feed routes intact.

**Tech Stack:** Node.js 22, TypeScript 5.9, Vitest, Zod, PostgreSQL/Supabase, Cheerio, Playwright Core, GitHub Actions, Firecrawl CLI.

**Spec:** `docs/superpowers/specs/2026-09-04-target-company-direct-discovery-design.md`

## Global constraints

- Keep `.github/workflows/poll.yml` on cron `2/5 * * * *`, `workflow_dispatch`, one concurrency group, `cancel-in-progress: false`, and a four-minute timeout.
- Keep the internal discovery deadline at 180,000 milliseconds and per-domain concurrency at two.
- Retain all active Simplify and secondary GitHub sources unless their own live verification fails.
- Use public employer and ATS endpoints only. Do not authenticate, bypass CAPTCHAs, rotate proxies, or scrape LinkedIn and Indeed.
- Use an eight-second source timeout, bounded retries with jitter, and `Retry-After` handling.
- Do not store or upload HTML, screenshots, cookies, browser profiles, applicant data, or raw job payloads.
- Use sanitized fixtures with reserved example domains.

---

### Task 1: Add careers-page source metadata to the database and core contract

**Files:**
- Modify: `packages/core/src/discovery.ts`
- Modify: `packages/core/src/index.test.ts`
- Modify: `packages/core/src/database.types.ts`
- Modify: `supabase/schemas/00_types.sql`
- Modify: `supabase/schemas/01_tables.sql`
- Modify: `supabase/tests/database/03_constraints.test.sql`
- Create: `supabase/migrations/20260904000000_target_company_direct_discovery.sql`

**Interfaces:**
- Produces: `AtsType` with `career_page`.
- Produces: `SourceDefinition.renderMode: "http" | "browser"`.
- Produces: `source_endpoints.render_mode public.source_render_mode not null default 'http'`.

- [ ] **Step 1: Write failing core and database tests**

Add a core assertion that `sourceDefinitionSchema` accepts this literal and rejects any other render mode:

```ts
expect(sourceDefinitionSchema.parse({
  id: 13,
  ownerId: "40000000-0000-4000-8000-000000000004",
  ats: "career_page",
  boardIdentifier: "example-careers",
  endpointUrl: "https://careers.example.invalid/jobs",
  companyName: "Example Careers",
  renderMode: "browser",
})).toMatchObject({ ats: "career_page", renderMode: "browser" });
```

Add pgTAP assertions that `career_page` casts to `public.ats_type`, `browser` casts to `public.source_render_mode`, and an invalid render mode fails.

- [ ] **Step 2: Run the focused tests and confirm the missing enum/field failures**

Run: `pnpm --filter @internship-radar/core test -- src/index.test.ts`

Run: `supabase test db --local supabase/tests/database/03_constraints.test.sql`

Expected: core rejects `career_page`; database rejects the new enum values.

- [ ] **Step 3: Implement the schema and type changes**

Add `career_page` to `atsTypeSchema` and add this field to `sourceDefinitionSchema`:

```ts
renderMode: z.enum(["http", "browser"]).default("http"),
```

Create `public.source_render_mode` and add `render_mode` to `source_endpoints`. Mirror the change in a forward migration:

```sql
alter type public.ats_type add value if not exists 'career_page';
create type public.source_render_mode as enum ('http', 'browser');
alter table public.source_endpoints
  add column render_mode public.source_render_mode not null default 'http';
```

Update generated database types by hand to match the canonical schema, then verify them with the existing database-type gate.

- [ ] **Step 4: Run focused verification**

Run: `pnpm --filter @internship-radar/core test -- src/index.test.ts`

Run: `pnpm db:types:check`

Run: `supabase test db --local supabase/tests/database/03_constraints.test.sql`

Expected: all pass.

- [ ] **Step 5: Commit the contract**

```powershell
git add -- packages/core/src/discovery.ts packages/core/src/index.test.ts packages/core/src/database.types.ts supabase/schemas/00_types.sql supabase/schemas/01_tables.sql supabase/tests/database/03_constraints.test.sql supabase/migrations/20260904000000_target_company_direct_discovery.sql
git commit -m "Add careers page source contract"
```

### Task 2: Carry render mode through import and source loading

**Files:**
- Modify: `packages/migration/src/index.ts`
- Modify: `packages/migration/src/index.test.ts`
- Modify: `packages/migration/src/apply.ts`
- Modify: `packages/poller/src/postgrest.ts`
- Modify: `packages/poller/src/postgrest.test.ts`

**Interfaces:**
- Consumes: `SourceDefinition.renderMode` from Task 1.
- Produces: registry/import field `renderMode?: "http" | "browser"` with `http` as the default.
- Produces: PostgREST selection and mapping for `source_endpoints.render_mode`.

- [ ] **Step 1: Write failing migration and PostgREST tests**

Extend the migration fixture with a `career_page` source whose `renderMode` is `browser`. Assert that the migration plan retains `renderMode`, and the apply payload writes `render_mode: "browser"`. Extend the PostgREST row fixture and assert `listDueSources()` returns `renderMode: "browser"`.

- [ ] **Step 2: Run tests and confirm render mode is dropped**

Run: `pnpm --filter @internship-radar/migration test`

Run: `pnpm --filter @internship-radar/poller test -- src/postgrest.test.ts`

Expected: assertions fail because the import and loader omit `renderMode`.

- [ ] **Step 3: Implement import and loading support**

Add `career_page` to active and disabled registry Zod enums. Add `renderMode` to the source schema and registry source schema:

```ts
renderMode: z.enum(["http", "browser"]).default("http"),
```

Write `render_mode: source.renderMode` in `packages/migration/src/apply.ts`. Select `render_mode` in `PostgrestPollerDatabase.listDueSources()` and map it to `renderMode`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm --filter @internship-radar/migration test`

Run: `pnpm --filter @internship-radar/poller test -- src/postgrest.test.ts`

Expected: all pass.

- [ ] **Step 5: Commit data-flow support**

```powershell
git add -- packages/migration/src/index.ts packages/migration/src/index.test.ts packages/migration/src/apply.ts packages/poller/src/postgrest.ts packages/poller/src/postgrest.test.ts
git commit -m "Carry careers page render mode"
```

### Task 3: Add bounded browser transport

**Files:**
- Modify: `packages/poller/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `packages/poller/src/types.ts`
- Modify: `packages/poller/src/http.ts`
- Modify: `packages/poller/src/http.test.ts`
- Create: `packages/poller/src/browser-fetch.ts`
- Create: `packages/poller/src/browser-fetch.test.ts`

**Interfaces:**
- Produces: `AdapterRequest.transport?: "http" | "browser"`.
- Produces: `RequestJsonOptions.renderFetchImpl?: FetchLike`.
- Produces: `createChromiumFetch(options?: { chromium?: ChromiumLauncher }): Promise<{ fetch: FetchLike; close(): Promise<void> }>`.

- [ ] **Step 1: Write failing transport tests**

Assert that `requestSource({ url, responseType: "text", transport: "browser" }, { fetchImpl, renderFetchImpl })` calls `renderFetchImpl`, does not call `fetchImpl`, and returns rendered text. Assert that a missing render transport produces a sanitized nonretryable `network_error` without exposing the URL.

Add a browser-fetch test with a fake Playwright launcher. Assert launch options equal `{ channel: "chrome", headless: true }`, image/font/media requests abort, navigation uses `waitUntil: "domcontentloaded"` and `timeout: 8000`, and `close()` closes the browser.

- [ ] **Step 2: Run tests and confirm browser transport is unavailable**

Run: `pnpm --filter @internship-radar/poller test -- src/http.test.ts src/browser-fetch.test.ts`

Expected: TypeScript or assertions fail because the transport and factory do not exist.

- [ ] **Step 3: Implement browser transport**

Add `playwright-core` as an exact poller dependency. Route requests by transport in `requestSource`:

```ts
const requestFetch = request.transport === "browser"
  ? options.renderFetchImpl
  : options.fetchImpl ?? fetch;
if (requestFetch === undefined) {
  throw new SourceRequestError("network_error", "rendered source transport is unavailable", false);
}
```

Implement `createChromiumFetch()` with one shared Chromium instance. Return HTML in a standard `Response`, block resource types `image`, `media`, and `font`, and close each page in `finally`. Do not create a persistent context or write files.

- [ ] **Step 4: Run transport tests**

Run: `pnpm --filter @internship-radar/poller test -- src/http.test.ts src/browser-fetch.test.ts`

Expected: all pass.

- [ ] **Step 5: Commit browser transport**

```powershell
git add -- packages/poller/package.json pnpm-lock.yaml packages/poller/src/types.ts packages/poller/src/http.ts packages/poller/src/http.test.ts packages/poller/src/browser-fetch.ts packages/poller/src/browser-fetch.test.ts
git commit -m "Add bounded browser source transport"
```

### Task 4: Implement the careers-page adapter and HTTP-to-browser fallback

**Files:**
- Modify: `packages/poller/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `packages/poller/src/adapters/career-page.ts`
- Create: `packages/poller/src/adapters/career-page.test.ts`
- Modify: `packages/poller/src/adapters/index.ts`
- Modify: `packages/poller/src/types.ts`
- Modify: `packages/poller/src/pipeline.ts`
- Modify: `packages/poller/src/pipeline.test.ts`
- Modify: `packages/test-fixtures/src/ats.ts`

**Interfaces:**
- Produces: `careerPageAdapter: SourceAdapter`.
- Produces: optional `SourceAdapter.buildFallbackRequest(source, primaryResult)`.
- Consumes: browser transport from Task 3 when `source.renderMode === "browser"` and the HTTP parse returns no postings.

- [ ] **Step 1: Add sanitized fixtures and failing adapter tests**

Create fictional HTML fixtures using `https://jobs.example.invalid/` URLs. Cover:

- one `JobPosting` JSON-LD object;
- an `@graph` containing two jobs;
- an internship anchor fallback with a relative URL;
- malformed JSON-LD beside a valid job;
- duplicate canonical URLs;
- no recognized jobs.

Assert normalized title, canonical URL, external ID, location, dates, rejected-row count, and deduplication. Assert the adapter request uses `responseType: "text"` and the fallback request uses `transport: "browser"` only for `renderMode: "browser"`.

- [ ] **Step 2: Run adapter tests and confirm the adapter is missing**

Run: `pnpm --filter @internship-radar/poller test -- src/adapters/career-page.test.ts`

Expected: fail because `careerPageAdapter` does not exist.

- [ ] **Step 3: Implement deterministic HTML parsing**

Add exact `cheerio` dependency. Parse `script[type="application/ld+json"]`, recursively flatten `@graph`, and accept objects whose `@type` contains `JobPosting`. Parse `title`, `url`, `identifier.value`, `description`, `datePosted`, `validThrough`, `employmentType`, and `jobLocation`.

Use anchor fallback only when link text contains `intern`, `internship`, `co-op`, `working student`, or `student placement` and the resolved URL uses HTTPS. Hash the canonical URL for jobs without a public identifier. Reject malformed rows without discarding valid rows.

- [ ] **Step 4: Write and run the failing fallback test**

Add a pipeline test where the HTTP response contains no jobs and the rendered response contains one JSON-LD internship. Assert `runSource()` returns one posting after two transport calls. Add the inverse test proving an HTTP result skips Chromium.

Run: `pnpm --filter @internship-radar/poller test -- src/pipeline.test.ts`

Expected: fail because `runSource()` does not request the fallback.

- [ ] **Step 5: Implement fallback execution**

Extend `runSource()` to parse the primary response, request the optional fallback only when the primary result has zero postings, and combine attempt counts. Preserve existing malformed, partial, timeout, 429, 5xx, and source-isolation behavior.

- [ ] **Step 6: Run adapter and pipeline tests**

Run: `pnpm --filter @internship-radar/poller test -- src/adapters/career-page.test.ts src/pipeline.test.ts`

Expected: all pass.

- [ ] **Step 7: Commit careers-page discovery**

```powershell
git add -- packages/poller/package.json pnpm-lock.yaml packages/poller/src/adapters/career-page.ts packages/poller/src/adapters/career-page.test.ts packages/poller/src/adapters/index.ts packages/poller/src/types.ts packages/poller/src/pipeline.ts packages/poller/src/pipeline.test.ts packages/test-fixtures/src/ats.ts
git commit -m "Add careers page discovery adapter"
```

### Task 5: Wire Chromium into scheduled polling without changing broad sources

**Files:**
- Modify: `packages/poller/src/cli.ts`
- Modify: `packages/poller/src/scheduler.ts`
- Modify: `packages/poller/src/scheduler.test.ts`

**Interfaces:**
- Consumes: `createChromiumFetch()` and `renderFetchImpl` from Task 3.
- Produces: browser startup only when a due source has `renderMode === "browser"`.

- [ ] **Step 1: Write failing scheduler and workflow tests**

Add a scheduler test containing one broad secondary source and one careers-page source. Assert both run and deduplicate, a failed careers page leaves the broad posting intact, and `renderFetchImpl` reaches the careers-page pipeline.

Run the existing workflow validator to confirm the cron, dispatch, permissions, concurrency, timeout, partition count, and per-domain limit remain unchanged.

- [ ] **Step 2: Run tests and confirm render transport is not wired**

Run: `pnpm --filter @internship-radar/poller test -- src/scheduler.test.ts`

Run: `pnpm workflow:validate`

Expected: scheduler fails its rendered-source assertion; workflow invariants remain green.

- [ ] **Step 3: Implement conditional browser lifecycle**

Pass `renderFetchImpl` through `SchedulerCycleOptions` to `runSource()`. In the CLI, create the Chromium client only when `sources.some(source => source.renderMode === "browser")`, pass its fetch function, and close it in `finally`. Keep JSON output counts-only and sanitized.

Do not change the workflow schedule, permissions, concurrency, or timeout.

- [ ] **Step 4: Run scheduler, workflow, and poller tests**

Run: `pnpm --filter @internship-radar/poller test`

Run: `pnpm workflow:validate`

Expected: all pass.

- [ ] **Step 5: Commit scheduled browser support**

```powershell
git add -- packages/poller/src/cli.ts packages/poller/src/scheduler.ts packages/poller/src/scheduler.test.ts
git commit -m "Run due careers pages in scheduled poller"
```

### Task 6: Extend registry validation for Workday and careers pages

**Files:**
- Modify: `scripts/validate-source-registry.mjs`
- Modify: `scripts/validate-source-registry.test.mjs`

**Interfaces:**
- Produces: structural and live validation for `workday`, `hosted_json`, and `career_page` registry entries.

- [ ] **Step 1: Write failing direct-coverage tests**

Add positive fixtures for Workday POST verification and a `career_page` text response. Add negative fixtures for a missing Workday collection, unrecognized careers-page HTML, an invalid render mode, and a `career_page` interval shorter than 86,400 seconds.

- [ ] **Step 2: Run tests and confirm direct coverage is not enforced**

Run: `pnpm sources:test`

Expected: Workday and careers-page cases reject supported data or use the wrong request method.

- [ ] **Step 3: Implement structural and live validation**

Allow `workday`, `hosted_json`, and `career_page` in active and disabled registry entries. Build Workday live requests with the same POST body as the adapter. Fetch careers pages as text and require at least one recognized JSON-LD job or internship link. Validate `renderMode` and require Tier C interval 86,400 for `career_page`.

- [ ] **Step 4: Run source tests and structural validation**

Run: `pnpm sources:test`

Run: `pnpm sources:validate`

Expected: all tests and the current registry validation pass.

- [ ] **Step 5: Commit registry contract changes**

```powershell
git add -- scripts/validate-source-registry.mjs scripts/validate-source-registry.test.mjs
git commit -m "Validate direct source types"
```

### Task 7: Research and register all 45 target companies

**Files:**
- Modify: `.gitignore`
- Modify: `config/public-source-registry.json`
- Modify: `config/target-company-search.json`
- Create: `docs/target-company-direct-coverage.md`
- Local ignored evidence: `.firecrawl/target-company-*.json` and `.firecrawl/target-company-*.md`

**Interfaces:**
- Consumes: supported ATS and `career_page` contracts from Tasks 1 through 6.
- Produces: one direct active or disabled record for Google, Microsoft, Amazon, Apple, Meta, NVIDIA, IBM, Oracle, Salesforce, Adobe, Cisco, Intel, AMD, Qualcomm, Tesla, OpenAI, Anthropic, Cohere, Shopify, Stripe, Uber, Airbnb, Datadog, Snowflake, Palantir, ServiceNow, Atlassian, Cloudflare, MongoDB, GitHub, Reddit, Roblox, ByteDance, Block, Bloomberg, Autodesk, Thomson Reuters Labs, RBC Borealis, Wealthsimple, Clio, Waabi, Kinaxis, Coveo, D-Wave, and BlackBerry.
- Produces: each target `directCoverage` object with either `{ "state": "active", "ats": string, "boardIdentifier": string }` or `{ "state": "disabled", "ats": string, "boardIdentifier": string }`.

- [ ] **Step 1: Prepare private research output**

Add `.firecrawl/` to `.gitignore`. Run `firecrawl --status`, then search official career domains in batches. Save search and scrape output under `.firecrawl/`; do not check those files into Git.

- [ ] **Step 2: Discover official ATS or careers-page sources**

For each named company, start from the official careers site and record the final public careers URL, ATS type, tenant/board identifier, endpoint URL, request method, response schema, and whether Chromium is required. Prefer public ATS data endpoints over HTML pages.

Send Firecrawl search feedback once per search. Reject third-party job mirrors as direct coverage.

- [ ] **Step 3: Verify candidate endpoints**

Run bounded unauthenticated requests with the same headers, body, and timeout the poller will use. Require both the official careers page and endpoint to resolve. Require a recognized job collection with at least one entry for active sources.

Record failures as disabled rows with the checked URL, timestamp, ATS or `career_page` type, and one of these sanitized reasons: public endpoint missing, HTTP access control, CAPTCHA, empty result, timeout, malformed payload, or unsupported proprietary schema.

- [ ] **Step 4: Update registries and coverage report**

Add verified active rows without deleting current rows. Use Tier A/300 seconds for Tier 1 direct ATS sources, Tier B/1,800 seconds for Tier 2 direct ATS sources, and Tier C/86,400 seconds for careers-page sources. Link each target's `directCoverage` selector to its active or disabled row.

Create `docs/target-company-direct-coverage.md` with counts by state and ATS plus a 45-row table containing company, coverage state, source type, and official careers domain. Do not copy job descriptions or payloads.

- [ ] **Step 5: Write and run failing direct-coverage tests**

Add tests that mutate a fixture target to remove `directCoverage`, point active coverage at a nonexistent source, and point disabled coverage at a missing disabled record. Each command must exit nonzero with a sanitized company-specific validation message.

Run: `pnpm sources:test`

Expected: new negative cases return zero because direct coverage is not enforced.

- [ ] **Step 6: Enforce direct coverage**

Resolve every target's `directCoverage` selector against the corresponding active or disabled registry collection. Keep all existing `searchRoutes` checks. Print active and disabled direct-coverage counts in the structural validator output.

- [ ] **Step 7: Run registry validation**

Run: `pnpm sources:test`

Run: `pnpm sources:validate`

Run: `pnpm sources:verify-live`

Expected: structural tests pass; all active sources pass live checks; unavailable companies appear as disabled with dated reasons.

- [ ] **Step 8: Commit verified source inventory**

```powershell
git add -- .gitignore config/public-source-registry.json config/target-company-search.json docs/target-company-direct-coverage.md
git commit -m "Add direct coverage for target companies"
```

### Task 8: Verify privacy, full behavior, and rollout readiness

**Files:**
- Modify: `docs/public-source-registry.md`
- Modify: `docs/github-secondary-sources-runbook.md`
- Modify: `IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Consumes: completed source inventory and poller behavior.
- Produces: operator instructions for direct ATS and daily careers-page recovery.

- [ ] **Step 1: Update operator documentation**

Document direct and disabled counts, browser-source limits, daily intervals, manual workflow dispatch, sanitized error categories, and the rule that broad feeds remain active. Document how to disable one broken careers-page source without affecting other sources.

- [ ] **Step 2: Run the full repository verification**

Run: `pnpm privacy:scan`

Run: `pnpm skills:validate`

Run: `pnpm schema:validate`

Run: `pnpm sources:test`

Run: `pnpm sources:validate`

Run: `pnpm workflow:validate`

Run: `pnpm lint`

Run: `pnpm typecheck`

Run: `pnpm test`

Run: `pnpm build`

Run: `git diff --check`

Expected: every command exits zero. The privacy review finds only public employer metadata and sanitized fixtures in the new surface.

- [ ] **Step 3: Commit documentation**

```powershell
git add -- docs/public-source-registry.md docs/github-secondary-sources-runbook.md IMPLEMENTATION_STATUS.md
git commit -m "Document target company discovery operations"
```
