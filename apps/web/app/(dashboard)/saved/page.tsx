import Link from "next/link";
import { requireOwner } from "../../../lib/auth";
import { formatDate, formatEmployerName } from "../../../lib/job-presentation";
import { SaveJobButton } from "../_components/save-job-button";
import { AppliedJobButton } from "../_components/applied-job-button";

const PAGE_SIZE = 100;

export default async function SavedJobsPage() {
  const { client } = await requireOwner();
  const { data } = await client
    .from("jobs")
    .select("id,title,employer_name,location_text,state,preliminary_score,posted_at,saved_at,applied_at,companies(name)")
    .not("saved_at", "is", null)
    .order("saved_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const truncated = (data?.length ?? 0) > PAGE_SIZE;

  return <>
    <header className="page-header">
      <div><p className="eyebrow">SHORTLIST</p><h1>Saved jobs</h1></div>
      <p className="header-meta">{rows.length}{truncated ? "+" : ""} flagged for later<br />Most recently saved first</p>
    </header>
    {rows.length === 0 ? (
      <p className="empty">No saved jobs yet. Use <strong>Save</strong> on any job to flag it for later.</p>
    ) : <>
      {truncated ? <p className="warning" role="status">Showing the {PAGE_SIZE} most recently saved jobs. Unsave some to see older ones.</p> : null}
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Saved jobs table">
        <table className="data-table">
          <thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Saved</th><th>Score</th><th>Status</th><th>Reference</th><th><span className="sr-only">Remove from saved</span></th></tr></thead>
          <tbody>{rows.map(job => <tr key={job.id}>
            <td><Link href={`/jobs/${job.id}`}><strong>{job.title}</strong></Link></td>
            <td>{formatEmployerName(job.employer_name, job.companies)}</td>
            <td>{job.location_text ?? "Not listed"}</td>
            <td><time dateTime={job.saved_at ?? undefined}>{formatDate(job.saved_at)}</time></td>
            <td>{Number(job.preliminary_score)}/100</td>
            <td><span className="badge">{job.state.replaceAll("_", " ")}</span></td>
            <td><AppliedJobButton jobId={Number(job.id)} title={job.title} appliedAt={job.applied_at ?? null} /></td>
            <td><SaveJobButton jobId={Number(job.id)} title={job.title} savedAt={job.saved_at ?? null} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </>;
}
