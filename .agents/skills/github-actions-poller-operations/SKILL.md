---
name: github-actions-poller-operations
description: Operate and recover the Internship Radar GitHub Actions poller while preserving concurrency, time-budget, fixture-only PR, privacy, and free-tier constraints.
---

# GitHub Actions poller operations

Use this skill for scheduler configuration, manual recovery, health diagnosis, and runbook changes.

## Required invariants

- Keep the scheduled workflow on the default branch with cron `2/5 * * * *` and `workflow_dispatch` recovery.
- Use one concurrency group with `cancel-in-progress: false`; also enforce overlap prevention in persisted run state.
- Keep the workflow timeout at four minutes and the internal discovery deadline at three minutes.
- Partition sources by a stable endpoint hash and apply per-domain concurrency limits.
- Persist successful sources even when another source fails, then record a sanitized partial/failed run before exiting.
- Use minimal permissions and pin every third-party action to an immutable commit SHA.
- Pull-request workflows use sanitized fixtures only, receive no production secrets, and never use `pull_request_target`.
- Do not upload runtime data, postings, applicant data, database exports, or email content as Actions artifacts.

Treat a schedule gap as possible GitHub delay rather than guaranteed product latency. Surface a warning after 20 minutes without a successful run and document manual recovery with `gh workflow enable poll.yml` plus workflow dispatch. Never enable billing or paid runners to recover capacity.
