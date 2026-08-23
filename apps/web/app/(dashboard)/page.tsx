import { getDashboardSnapshot } from "../../lib/dashboard-data";
import { requireOwner } from "../../lib/auth";

export default async function DashboardPage() {
  const { client } = await requireOwner();
  const data = await getDashboardSnapshot(client);
  const runStale = data.latestRun?.finished_at === null
    || data.latestRun?.finished_at === undefined
    || Date.now() - new Date(data.latestRun.finished_at).valueOf() > 20 * 60_000;
  return (
    <>
      <header className="page-header"><div><p className="eyebrow">OPERATIONS / TODAY</p><h1>Internship radar</h1></div><p className="header-meta">Owner workspace<br />Live private data</p></header>
      {runStale && <section className="warning" role="status"><strong>Scheduler attention required.</strong> No successful run has finished in the last 20 minutes. Check Runs and use manual recovery if needed.</section>}
      <section className="metric-grid" aria-label="Current totals">
        {[["New jobs",data.newJobs],["Priority",data.priorityJobs],["Queued",data.queuedApplications],["Source issues",data.sourceFailures],["Email backlog",data.pendingEmails]].map(([label,value]) => <article className="metric" key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </section>
      <section className="panel-grid">
        <article className="panel"><p className="eyebrow">LATEST RUN</p><h2>{data.latestRun?.outcome ?? "No run recorded"}</h2><dl className="run-stats"><div><dt>Attempted</dt><dd>{data.latestRun?.attempted_count ?? 0}</dd></div><div><dt>Succeeded</dt><dd>{data.latestRun?.succeeded_count ?? 0}</dd></div><div><dt>Failed</dt><dd>{data.latestRun?.failed_count ?? 0}</dd></div></dl></article>
        <article className="panel priority-panel"><p className="eyebrow">NEXT ACTION</p><h2>Review priority matches</h2><p>Open verified roles scoring 80 or higher before preparing an application package.</p><a className="primary-action" href="/jobs?minimumScore=80">Open priority jobs</a></article>
      </section>
      <section className="usage-panel" aria-labelledby="usage-heading">
        <div><p className="eyebrow">FAIL-CLOSED CAPS</p><h2 id="usage-heading">Usage meters</h2></div>
        <UsageMeter label="Emails today" value={data.dailyEmailSent} limit={data.limits?.daily_email_cap ?? 50} />
        <UsageMeter label="Emails this month" value={data.monthlyEmailSent} limit={data.limits?.monthly_email_cap ?? 2500} />
      </section>
    </>
  );
}

function UsageMeter({label,value,limit}:{label:string;value:number;limit:number}) {
  const percentage = Math.min(100, Math.round((value / limit) * 100));
  return <div className="usage-meter"><div><strong>{label}</strong><span>{value} / {limit}</span></div><progress max={limit} value={value} aria-label={`${label}: ${value} of ${limit}`} /><small>{percentage}% used</small></div>;
}
