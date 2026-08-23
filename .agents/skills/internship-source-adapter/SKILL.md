---
name: internship-source-adapter
description: Add or maintain a public internship-source adapter using sanitized fixtures, bounded networking, canonical employer links, and failure-isolated discovery behavior.
---

# Internship source adapter

Use this skill when implementing or changing an ATS, company-feed, or secondary-discovery adapter.

## Adapter contract

- Access only public employer or ATS endpoints; do not authenticate to LinkedIn or Indeed, evade access controls, bypass CAPTCHAs, rotate proxies, or add stealth behavior.
- Resolve secondary leads to a canonical employer or ATS posting before marking them verified.
- Emit normalized source records without applicant PII or raw secrets.
- Preserve the stable ATS type plus external job ID and a canonical URL when available.
- Use an eight-second request timeout, bounded retries with jitter, and `Retry-After` for 429 responses.
- Classify empty results, timeouts, 429s, 5xx responses, malformed payloads, and partial results distinctly.
- Never let one endpoint failure discard successful results from another endpoint.

## Required verification

Add sanitized fixtures and tests for success, empty results, changed postings, duplicates, 429, 5xx, timeout, malformed input, and partial failure. Fixtures must contain fictional people and reserved example domains. Record only sanitized errors suitable for a public Actions log.

An unresolved endpoint stays disabled with a reason and last-check timestamp; do not claim it is verified.
