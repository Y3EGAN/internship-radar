# Internship Radar

Internship Radar is a private, single-owner internship discovery and application-assistance system designed to be developed in a public repository without exposing applicant data.

The planned system combines a Next.js dashboard, Supabase, a GitHub Actions poller, durable Resend alerts, Codex-assisted document preparation, and a local Windows Playwright companion. The local companion always stops before final submission.

## Safety boundaries

- Never commit applicant PII, documents, tokens, production data, browser state, or unsanitized fixtures.
- Never automate the final submission of an application.
- Never infer sensitive or unknown application answers.
- Keep service-role, OAuth, Resend, and device secrets out of browser bundles.
- Keep all providers within explicitly configured free-tier safety limits.

Development status and gate evidence are tracked in `IMPLEMENTATION_STATUS.md`.
