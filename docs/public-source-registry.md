# Public source registry

`config/public-source-registry.json` is the sanitized, repository-safe input for the initial production source import. It contains public employer and ATS metadata only; it contains no applicant, résumé, account, token, or private tracker data.

## Verified inventory

On 2026-08-22 (America/Toronto), the live validator passed all 98 active sources:

| ATS | Active sources |
| --- | ---: |
| Greenhouse | 53 |
| Lever | 2 |
| Ashby | 26 |
| SmartRecruiters | 17 |
| **Total** | **98** |

Each active source passed an unauthenticated bounded GET against both its public ATS endpoint and public career page. The ATS response also had the expected job-list schema. Three boards whose career pages independently returned HTTP 403 or 520 are excluded from the active list and recorded in `disabledSources` with a timestamp and sanitized reason. Disabled entries are never imported.

## Polling tiers

- Tier A: every 300 seconds.
- Tier B: every 1,800 seconds.
- Tier C: every 86,400 seconds.

These intervals are statically enforced. Runtime discovery filters broad boards to explicit internship, co-op, working-student, or student-placement signals before persistence, limiting database growth and free-tier consumption.

## Validation and import

Run the repository-safe structural gate with `pnpm sources:validate`. Run the network check with `pnpm sources:verify-live`; this performs read-only requests to public pages and APIs.

During the authorized private migration, merge this registry with the private export:

`pnpm migration:plan -- <private-export.json> --registry config/public-source-registry.json --report <ignored-counts-report.json>`

The counts-only report should show the private fixture/source rows plus 98 registry rows, with no registry rejection or duplicate. Production apply remains separately fingerprint-confirmed and requires server-only credentials.
