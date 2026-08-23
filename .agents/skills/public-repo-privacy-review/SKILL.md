---
name: public-repo-privacy-review
description: Review Internship Radar changes before public exposure for applicant PII, secrets, private documents, unsafe logs, unsanitized fixtures, and client-bundled privileged keys.
---

# Public repository privacy review

Run this review before a public push, after adding fixtures or logging, and whenever authentication, storage, email, document, or browser-agent code changes.

## Review surface

Inspect tracked files, staged changes, the relevant Git history, generated artifacts, workflow configuration, browser bundles, test snapshots, and logs for:

- names, personal email addresses, phone numbers, postal addresses, resumes, cover letters, application answers, or other applicant PII;
- service-role keys, database passwords, Resend keys, OAuth secrets, device tokens, cookies, browser profiles, and private-key material;
- production rows, database dumps, spreadsheet exports, private storage paths, live webhook payloads, or unsanitized fixtures;
- runtime data uploaded as Actions artifacts or printed in logs;
- any privileged secret exposed through a `NEXT_PUBLIC_` variable or client component.

## Decision rule

Use fictional identities and reserved example domains in fixtures. Report file and invariant, not the sensitive value. If a finding may be real, stop publication, rotate exposed credentials through the provider interface, and remove the value from the complete Git history. Do not paste secrets or private data into chat, issues, or review comments.

Passing a regex scan is necessary but not sufficient: review semantic leaks such as realistic resumes, proprietary postings, screenshots, filenames, and encoded payloads.
