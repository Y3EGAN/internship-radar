# Public source registry

`config/public-source-registry.json` is the sanitized, repository-safe input for the initial production source import. It contains public employer and ATS metadata only; it contains no applicant, résumé, account, token, or private tracker data.

## Verified inventory

The inventory now contains 117 active endpoints. All 117 passed the bounded live gate on 2026-09-05. The 45-company target contract has 25 active direct sources and 20 dated disabled direct records; every target also retains the broad-feed route.

| ATS | Active sources |
| --- | ---: |
| Greenhouse | 55 |
| Lever | 3 |
| Ashby | 28 |
| Workday | 7 |
| SmartRecruiters | 17 |
| Simplify repository JSON | 1 |
| Secondary repository Markdown | 5 |
| Careers page | 1 |
| **Total** | **117** |

Each active source passed an unauthenticated bounded request against both its public endpoint and public career or repository page. Workday uses its public POST collection; all other current ATS sources use GET. Responses must have the expected job-list schema or recognized nonempty HTML/repository content. Disabled entries are never imported.

## Polling tiers

- Tier A: every 300 seconds.
- Tier B: every 1,800 seconds.
- Tier C: every 86,400 seconds.

These intervals are statically enforced. Runtime discovery filters broad boards to explicit internship, co-op, working-student, or student-placement signals before persistence, limiting database growth and free-tier consumption.

## Target-company searches

`config/target-company-search.json` is the durable search contract for the 45 requested employers. It keeps one canonical company row, known recruiting aliases (including TikTok, Square, QNX, and the requested Canadian variants), Canada-focused locations, the active broad-feed route, and one direct active or disabled selector. Direct employer boards are complementary coverage; they do not replace the broad feeds.

The source validation gate fails if a requested canonical company or alias disappears, a company loses every search route, a route references an inactive source, or direct coverage no longer resolves to the named company's active/disabled record. See `docs/target-company-direct-coverage.md` for the 45-row inventory.

The active Apple source is checked daily. It requests HTML normally and uses one shared headless Chrome process only if the initial page contains no recognized jobs. Images, fonts, and media are blocked; pages close after each request, and the browser closes after the cycle. Browser output, screenshots, cookies, profiles, and raw HTML are never persisted.

## Validation and import

Run the repository-safe structural gates with `pnpm sources:test` and `pnpm sources:validate`. Run the network check with `pnpm sources:verify-live`; this performs read-only requests to public pages and APIs.

During the authorized private migration, merge this registry with the private export:

`pnpm migration:plan -- <private-export.json> --registry config/public-source-registry.json --report <ignored-counts-report.json>`

The counts-only report should show the private fixture/source rows plus 117 active registry rows, with no registry rejection or endpoint duplicate. Production apply remains separately fingerprint-confirmed and requires server-only credentials.
