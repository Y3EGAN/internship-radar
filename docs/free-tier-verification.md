# Free-tier verification

Verified against provider documentation on 2026-08-22. The production read-only validator requires explicit plan attestations and fails if any application gate is unmet.

| Provider | Verified included behavior | Internal fail-closed control |
| --- | --- | --- |
| Supabase Free | $0; 500 MB database; 1 GB file storage; 5 GB egress and cached egress; no automatic backups; projects can pause after one inactive week; two active projects. | Profile constraints cap database at 400 MB and storage at 800 MB. Retention jobs remove bounded payloads. Production gate requires `RADAR_SUPABASE_PLAN=free`. |
| Resend Free | 100 transactional emails/day and 3,000/month, including inbound; 30-day retention. | Database constraints cap delivery at 50/day and 2,500/month. The durable sender refuses over-cap messages. Production gate requires `RADAR_RESEND_PLAN=free`. |
| Vercel Hobby | Free, personal/non-commercial use only; most exhausted resources remain unavailable until the rolling period resets rather than allowing Hobby overage. | This project is eligible only while it remains personal and non-commercial. No Vercel cron or paid feature is configured. Production gate requires `RADAR_VERCEL_PLAN=hobby`. |
| GitHub Actions | Five minutes is the shortest scheduled interval. Standard hosted runners are free for public repositories. Public scheduled workflows disable after 60 days without repository activity. | Workflow uses `ubuntu-latest`, a four-minute timeout, no artifacts, serialized cycles, and `2/5 * * * *`. Health UI treats a delay over 20 minutes as stale. Production gate requires public visibility. |

Authoritative references: [Supabase pricing](https://supabase.com/pricing), [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [GitHub schedule syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions), and [GitHub workflow re-enablement](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows?tool=cli).

These are implementation-time assumptions, not permanent guarantees. Re-run this review before provider setup and after any provider pricing or policy notice. Do not add a payment method, enable overage, select a paid runner, start a Vercel trial, or upgrade a plan as part of cutover.
