# Poller operations

The poller is best-effort. GitHub scheduled workflows may be delayed or dropped, and inactive public-repository schedules may be disabled. A five-minute cron is not a five-minute delivery guarantee.

## Required repository configuration

Keep `.github/workflows/poll.yml` on the default branch and configure these Actions secrets:

- `OWNER_USER_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is server-only. It must never be exposed to pull-request workflows, browser variables, logs, or artifacts.

## Health and recovery

The dashboard must show a prominent warning when no `succeeded` source run has finished in the last 20 minutes. A `partial` or `failed` run proves the scheduler executed but does not clear that warning.

Inspect recent workflow state:

```sh
gh run list --workflow poll.yml --limit 5
```

If the schedule is disabled or stale, recover it without enabling paid runners:

```sh
gh workflow enable poll.yml
gh workflow run poll.yml
gh run watch
```

Actions concurrency and the partial unique database index both prevent overlapping cycles. A skipped overlapping run is expected and should not be retried until the active run finishes or is explicitly diagnosed. Never upload runtime postings, applicant records, database exports, or email content as an Actions artifact.
