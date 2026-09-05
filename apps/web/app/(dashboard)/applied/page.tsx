import Link from "next/link";
import { requireOwner } from "../../../lib/auth";
import { formatDate, formatEmployerName } from "../../../lib/job-presentation";
import { AppliedJobButton } from "../_components/applied-job-button";

const PAGE_SIZE = 100;

export default async function AppliedJobsPage() {
  const { client } = await requireOwner();
  const { data } = await client
    .from("jobs")
    .select("id,title,employer_name,canonical_url,location_text,preliminary_score,applied_at,companies(name)")
    .not("applied_at", "is", null)
    .order("applied_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const truncated = (data?.length ?? 0) > PAGE_SIZE;

  return <>
    <header className="page-header">
      <div><p className="eyebrow">MANUAL APPLICATIONS</p><h1>Applied jobs</h1></div>
      <p className="header-meta">{rows.length}{truncated ? "+" : ""} manually applied<br />Most recent first</p>
    </header>
    {rows.length === 0 ? (
      <p className="empty">No manually applied jobs yet. Use <strong>Mark applied</strong> on a job to keep it here for reference.</p>
    ) : <>
      {truncated ? <p className="warning" role="status">Showing the {PAGE_SIZE} most recent manual applications.</p> : null}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Manually applied jobs table">
        <table className="data-table">
          <thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Applied</th><th>Score</th><th>Posting</th><th><span className="sr-only">Applied status</span></th></tr></thead>
          <tbody>{rows.map(job => <tr key={job.id}>
            <td><Link href={`/jobs/${job.id}`}><strong>{job.title}</strong></Link></td>
            <td>{formatEmployerName(job.employer_name, job.companies)}</td>
            <td>{job.location_text ?? "Not listed"}</td>
            <td><time dateTime={job.applied_at ?? undefined}>{formatDate(job.applied_at)}</time></td>
            <td>{Number(job.preliminary_score)}/100</td>
            <td>{job.canonical_url ? <a href={job.canonical_url} target="_blank" rel="noopener noreferrer">Open posting <span aria-hidden="true">↗</span><span className="sr-only"> in a new tab</span></a> : "Unavailable"}</td>
            <td><AppliedJobButton jobId={Number(job.id)} title={job.title} appliedAt={job.applied_at ?? null} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </>;
}
