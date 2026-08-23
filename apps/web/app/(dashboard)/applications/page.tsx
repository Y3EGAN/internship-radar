import Link from "next/link";
import { requireOwner } from "../../../lib/auth";

const columns = ["not_started", "queued_for_codex", "preparing", "needs_input", "ready_for_review", "submitted"] as const;

export default async function ApplicationsPage() {
  const { client } = await requireOwner();
  const { data } = await client.from("applications").select("id,state,created_at,jobs(title)").order("created_at", { ascending:false }).limit(100);
  const rows = data ?? [];
  return <><header className="page-header"><div><p className="eyebrow">PREPARATION PIPELINE</p><h1>Applications</h1></div></header>{rows.length===0?<p className="empty">No application packages are queued.</p>:<section className="pipeline-board" aria-label="Application pipeline">{columns.map(column=><section className="pipeline-column" key={column}><h2>{column.replaceAll("_", " ")}</h2><p className="column-count">{rows.filter(row=>row.state===column).length}</p>{rows.filter(row=>row.state===column).map(row=><Link className="pipeline-card" href={`/applications/${row.id}`} key={row.id}><strong>{(row.jobs as {title?:string}|null)?.title??"Application"}</strong><span>{new Date(row.created_at).toLocaleDateString("en-CA")}</span></Link>)}</section>)}</section>}</>;
}
