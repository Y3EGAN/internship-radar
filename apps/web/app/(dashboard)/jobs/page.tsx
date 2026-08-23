import Link from "next/link";
import { requireOwner } from "../../../lib/auth";
import { decodeJobCursor, encodeJobCursor } from "../../../lib/job-cursor";

const PAGE_SIZE = 50;

type JobSearch = { cursor?: string; minimumScore?: string; state?: string; location?: string };

export default async function JobsPage({ searchParams }: { searchParams: Promise<JobSearch> }) {
  const { client } = await requireOwner();
  const filters = await searchParams;
  const cursor = decodeJobCursor(filters.cursor);
  const minimumScore = Math.min(100, Math.max(0, Number.parseInt(filters.minimumScore ?? "0", 10) || 0));
  const state = ["discovered", "shortlisted", "dismissed", "expired"].includes(filters.state ?? "") ? filters.state : undefined;
  const location = filters.location?.trim().slice(0, 80);
  let query = client.from("jobs").select("id,title,location_text,state,preliminary_score,discovered_at").order("discovered_at", { ascending:false }).order("id", { ascending:false }).limit(PAGE_SIZE + 1);
  if (minimumScore > 0) query = query.gte("preliminary_score", minimumScore);
  if (state) query = query.eq("state", state);
  if (location) query = query.ilike("location_text", `%${location.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  if (cursor) query = query.or(`discovered_at.lt.${cursor.discoveredAt},and(discovered_at.eq.${cursor.discoveredAt},id.lt.${cursor.id})`);
  const { data } = await query;
  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const hasNext = (data?.length ?? 0) > PAGE_SIZE;
  const last = rows.at(-1);
  const nextCursor = last ? encodeJobCursor(last.discovered_at, Number(last.id)) : null;
  const nextQuery = new URLSearchParams();
  if (minimumScore) nextQuery.set("minimumScore", String(minimumScore));
  if (state) nextQuery.set("state", state);
  if (location) nextQuery.set("location", location);
  if (nextCursor) nextQuery.set("cursor", nextCursor);
  return <><header className="page-header"><div><p className="eyebrow">DISCOVERY</p><h1>Jobs</h1></div><p className="header-meta">Up to {PAGE_SIZE} per page<br />Newest first</p></header><form className="filter-bar" method="get"><label>Minimum score<input name="minimumScore" type="number" min="0" max="100" defaultValue={minimumScore || ""} /></label><label>Status<select name="state" defaultValue={state??""}><option value="">All statuses</option><option value="discovered">Discovered</option><option value="shortlisted">Shortlisted</option><option value="dismissed">Dismissed</option><option value="expired">Expired</option></select></label><label>Location<input name="location" type="search" defaultValue={location??""} /></label><button type="submit">Apply filters</button></form>{rows.length===0?<p className="empty">No jobs match these filters.</p>:<><table className="data-table"><thead><tr><th>Role</th><th>Location</th><th>Score</th><th>Status</th></tr></thead><tbody>{rows.map(job=><tr key={job.id}><td><Link href={`/jobs/${job.id}`}><strong>{job.title}</strong></Link></td><td>{job.location_text??"Not listed"}</td><td>{Number(job.preliminary_score)}/100</td><td><span className="badge">{job.state}</span></td></tr>)}</tbody></table>{hasNext && nextCursor?<nav className="pagination" aria-label="Jobs pagination"><Link className="primary-action" href={`/jobs?${nextQuery.toString()}`}>Next page</Link></nav>:null}</>}</>;
}
