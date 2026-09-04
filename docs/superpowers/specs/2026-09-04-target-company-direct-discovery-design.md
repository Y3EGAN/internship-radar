# Target-company direct discovery design

## Goal

Internship Radar will add direct coverage for the 45 companies in `config/target-company-search.json` while retaining all current broad internship feeds. The poller will use a public ATS endpoint when the employer exposes one and will inspect the public careers website once per day when no supported endpoint exists.

## Coverage contract

Each target company will have at least one broad-feed route and one direct-coverage record. The direct record will use one of these states:

- `active`: a verified public ATS or careers-page source produced a recognized response.
- `disabled`: research found no usable public source, or the source returned an access-control, schema, timeout, or empty-result failure. The record includes a public URL, check time, and sanitized reason.

The importer does not treat a broad feed as proof that direct coverage exists. The source validator will fail when a target lacks a direct active or disabled record. Existing broad sources remain active unless their own verification fails.

## Source discovery

The discovery pass starts from each employer's official careers page. It follows public redirects and inspects public network or page metadata for Greenhouse, Lever, Ashby, Workday, SmartRecruiters, or hosted JSON endpoints. It does not authenticate, solve CAPTCHAs, rotate proxies, or query LinkedIn and Indeed.

Researchers will verify the careers page and endpoint with bounded requests. A direct source becomes active only when the endpoint returns a recognized nonempty job-list schema and the careers page resolves. Research results contain company metadata and sanitized failure reasons; they contain no applicant data or copied job descriptions.

## Direct ATS polling

The registry will continue using existing adapters for Greenhouse, Lever, Ashby, SmartRecruiters, and hosted JSON. Workday sources will use the existing Workday adapter after the registry validator gains support for bounded POST verification.

Direct sources use the existing tiers and scheduling rules. Tier 1 targets poll every five minutes, Tier 2 targets every 30 minutes, and Canada-focused or website-only Tier 3 targets poll once per day unless an existing higher-priority direct source already uses a shorter interval.

## Careers-page scraping

The schema will add a `career_page` source type for target companies without a usable ATS endpoint. Its adapter will parse public HTML for JobPosting JSON-LD, embedded public job data, and canonical job links. Company-specific parsing rules may extend the adapter when a stable public page cannot use the generic parser.

The adapter will attempt a normal HTTP fetch first. A rendered-page client will open Chromium only when the configured source requires JavaScript. It will not accept cookies, log in, submit forms, capture screenshots, or retain a browser profile. Each navigation has an eight-second timeout, and each source can visit the configured careers page plus one public pagination or data URL.

The existing five-minute workflow will run website sources through the same persisted due-time and stable-hash partitioning used for ATS sources. Each careers-page source becomes due once per day. The scheduler processes only the due partition that fits the three-minute internal deadline, then leaves remaining sources due for later scheduled runs. Per-domain concurrency limits protect employer sites.

## Normalization and deduplication

All adapters emit the existing normalized posting shape with a stable source type, external ID, employer name, title, canonical employer URL, location, and optional dates. Careers-page sources derive the external ID from a public identifier or a stable canonical-URL hash.

The existing canonical URL and posting fingerprint logic merges duplicates found through direct ATS, careers-page, and broad-feed sources. A verified direct source retains precedence over a secondary feed.

## Failure handling

The poller classifies empty lists, malformed pages, timeouts, HTTP 429, access-control responses, and server errors separately. It uses the existing retry, jitter, and `Retry-After` behavior. One failed website does not discard postings from another source.

The poller records sanitized errors and partial outcomes in persisted run state. It does not upload HTML, screenshots, job payloads, cookies, or runtime data as GitHub Actions artifacts. A parser that stops recognizing a page fails closed instead of reporting a successful zero-job result.

## Validation and tests

Registry tests will require all 45 targets, their requested aliases, broad routes, and a direct active or disabled record. Live validation will support Workday POST bodies and careers-page verification.

Sanitized adapter fixtures will cover successful HTML and rendered parsing, empty results, changed postings, duplicates, 429, 5xx, timeout, malformed input, and partial failure. Scheduler tests will prove daily due-time behavior, deadline deferral, source isolation, and direct-source precedence. Workflow, privacy, lint, type, unit, and source gates must pass before rollout.

## Rollout

The implementation will first add schema and adapter support, then research and register the 45 companies. A counts-only import plan will verify the source changes before any production write. Production rollout will import the verified registry and observe hosted runs for partial failures, deadline pressure, and unexpected source volume.

The rollout will not remove broad sources, enable paid runners, increase the four-minute workflow timeout, or publish scraped payloads. Companies that lack a compliant public source remain visible in the disabled registry for later re-verification.
