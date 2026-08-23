# Public repository privacy audit

Reviewed on 2026-08-22 (America/Toronto) using the `public-repo-privacy-review` procedure.

## Result

The current public-candidate surface contains only source code, sanitized fixtures, public employer/ATS metadata, documentation, and example-invalid identities. No applicant document, applicant fact, private tracker export, production record, token, browser profile, database dump, or live credential was found.

Checks covered:

- secret and private-key patterns, privileged `NEXT_PUBLIC_*` names, bearer values, provider-token formats, and credential-bearing URLs;
- direct identifiers, non-fixture email addresses, phone numbers, résumé/CV artifacts, private document formats, encoded blobs, and unsafe filenames;
- workflow triggers, permissions, artifacts, logs, fixtures, and the absence of `pull_request_target`;
- public employer endpoints and career URLs, which contain employer metadata only;
- generated migration and E2E setup code, whose identity and content use `.example.invalid` fixtures and local-only Supabase state;
- ignore rules for private configuration, documents, tracker exports, browser state, traces, DPAPI files, and encrypted/plain database exports.

## Git-state limitation

The repository currently has no tracked baseline, staged files, or commits: the candidate implementation is entirely untracked. Therefore tracked/staged/history scans are empty and cannot prove what a future commit will contain. Run `pnpm privacy:scan`, inspect the exact staged set, and repeat this semantic review immediately before the first public commit or push. No files were staged or committed by this audit.
