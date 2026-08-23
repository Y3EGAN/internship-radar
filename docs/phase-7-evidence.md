# Phase 7 gate evidence

Verified locally on 2026-08-22 with Playwright 1.62.0, installed Google Chrome, Windows DPAPI, sanitized static ATS fixtures, and the local Supabase stack.

## Pairing and local durability

- Owner-created pairing codes contain 192 bits of randomness, are stored only as SHA-256 hashes, expire within ten minutes, and are consumable once.
- Consuming a pairing returns a 256-bit device token once; the database stores only its SHA-256 hash. Active tokens expire after 90 days, update `last_used_at`, and stop authenticating immediately after owner revocation.
- The Windows companion passes plaintext tokens to a PowerShell child through stdin, protects/unprotects with current-user DPAPI, and writes only ciphertext under `%LOCALAPPDATA%\InternshipRadar`.
- The sandbox prevents Vitest from spawning PowerShell, so that one subprocess test is opt-in. The exact current-user DPAPI protect/unprotect primitive passed a separate direct fixture round-trip, and the executable default suite records the subprocess case as skipped.
- Queue updates use write-then-rename atomic replacement. `radar backup` streams a custom-format database export through AES-256-GCM and protects the random AES key with Windows DPAPI; database bytes and the decryption key are never written in plaintext. The format and prerequisites are documented in `docs/local-encrypted-backup.md`.

## Review-only browser agent

- Commands implement `radar pair`, `status`, `apply`, `resume`, and `backup`. Chrome uses a dedicated persistent profile at `%LOCALAPPDATA%\InternshipRadar\chrome-profile`.
- The agent downloads private resume artifacts through five-minute signed URLs into its local private artifact directory, inspects labels/required state, fills known safe profile fields, applies explicitly approved answers, and uploads the approved resume first.
- Greenhouse, Lever, and Ashby are supported single-page flows. Workday, SmartRecruiters, and iCIMS deliberately pause as assisted multi-page flows; unknown required fields, sensitive questions, login, and CAPTCHA also pause.
- The browser action union contains only `fill`, `select`, and `upload`; no click or submit action exists. The server accepts only progress, paused, and review-ready events.

## Gate results

- Eleven default local-agent tests pass for platform detection, safe planning, sensitive/unknown pauses, assisted flows, durable queue behavior, and absence of a submit action. The final opt-in Windows suite passes all 16 tests, including DPAPI token/backup encryption and three real-Chrome fixtures.
- Three explicit real-Chrome fixtures for Greenhouse, Lever, and Ashby fill four fields and reach review state. Each page includes a working submit sentinel; none was fired.
- Twenty companion pgTAP assertions cover privileges, bounded/single-use pairing, hash-only tokens, exclusive claims, progress, review-ready, expiry, revocation, and the rejected `final_submit` event. The final full database suite passes all 128 assertions.
- Security advisors report no issues, generated types match, web and agent lint/typechecks pass, and six web tests cover owner/Codex/device authentication primitives.
- The production build emits all pairing and companion routes. The final browser bundle scan passes across 50 static artifacts and the privacy scan passes across 227 public candidate files.

No live ATS page, real application, or real credential was opened during the gate. The local agent has no code path that can click final Submit.
