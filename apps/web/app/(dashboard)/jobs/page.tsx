import Link from "next/link";
import { requireOwner } from "../../../lib/auth";
import { decodeJobCursor, encodeJobCursor } from "../../../lib/job-cursor";
import { formatCompanyName, formatDate } from "../../../lib/job-presentation";
import { SaveJobButton } from "../_components/save-job-button";
import { AppliedJobButton } from "../_components/applied-job-button";

const PAGE_SIZE = 50;
const JOB_STATES = ["discovered", "needs_verification", "verified", "shortlisted", "dismissed", "closed"] as const;
const TERMS = ["fall-2026", "winter-2027", "summer-2027"] as const;
const POSTED_WINDOWS = ["1", "3", "7", "30"] as const;
const WORKPLACES = ["remote", "in-person"] as const;
const SCHEDULES = ["part-time", "full-time"] as const;

type JobSearch = {
  cursor?: string;
  minimumScore?: string;
  state?: string;
  location?: string;
  term?: string;
  postedWithin?: string;
  workplace?: string;
  schedule?: string;
};

function includes<const T extends readonly string[]>(values: T, value: string | undefined): value is T[number] {
  return value !== undefined && values.includes(value);
}

const termQueries: Record<(typeof TERMS)[number], string> = {
  "fall-2026": "title.ilike.%fall%2026%,title.ilike.%autumn%2026%,description.ilike.%fall%2026%,description.ilike.%autumn%2026%",
  "winter-2027": "title.ilike.%winter%2027%,description.ilike.%winter%2027%",
  "summer-2027": "title.ilike.%summer%2027%,description.ilike.%summer%2027%",
};

export default async function JobsPage({ searchParams }: { searchParams: Promise<JobSearch> }) {
  const { client } = await requireOwner();
  const filters = await searchParams;
  const cursor = decodeJobCursor(filters.cursor);
  const minimumScore = Math.min(100, Math.max(0, Number.parseInt(filters.minimumScore ?? "0", 10) || 0));
  const state = includes(JOB_STATES, filters.state) ? filters.state : undefined;
  const term = includes(TERMS, filters.term) ? filters.term : undefined;
  const postedWithin = includes(POSTED_WINDOWS, filters.postedWithin) ? filters.postedWithin : undefined;
  const workplace = includes(WORKPLACES, filters.workplace) ? filters.workplace : undefined;
  const schedule = includes(SCHEDULES, filters.schedule) ? filters.schedule : undefined;
  const location = filters.location?.trim().slice(0, 80);

  let query = client
    .from("jobs")
    .select("id,title,location_text,state,preliminary_score,posted_at,discovered_at,saved_at,applied_at,companies(name)")
    .order("discovered_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (minimumScore > 0) query = query.gte("preliminary_score", minimumScore);
  if (state) query = query.eq("state", state);
  if (location) query = query.ilike("location_text", `%${location.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`);
  if (term) query = query.or(termQueries[term]);
  if (postedWithin) {
    const postedAfter = new Date(Date.now() - Number(postedWithin) * 86_400_000).toISOString();
    query = query.gte("posted_at", postedAfter);
  }
  if (workplace === "remote") query = query.or("location_text.ilike.%remote%,description.ilike.%remote%");
  if (workplace === "in-person") query = query.not("location_text", "ilike", "%remote%");
  if (schedule === "part-time") query = query.or("title.ilike.%part-time%,title.ilike.%part time%,description.ilike.%part-time%,description.ilike.%part time%");
  if (schedule === "full-time") query = query.or("title.ilike.%full-time%,title.ilike.%full time%,description.ilike.%full-time%,description.ilike.%full time%");
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
  if (term) nextQuery.set("term", term);
  if (postedWithin) nextQuery.set("postedWithin", postedWithin);
  if (workplace) nextQuery.set("workplace", workplace);
  if (schedule) nextQuery.set("schedule", schedule);
  if (nextCursor) nextQuery.set("cursor", nextCursor);

  const activeFilterCount = [minimumScore > 0, state, location, term, postedWithin, workplace, schedule].filter(Boolean).length;

  return <>
    <header className="page-header">
      <div><p className="eyebrow">DISCOVERY</p><h1>Jobs</h1></div>
      <p className="header-meta">Up to {PAGE_SIZE} per page<br />Newest discovered first</p>
    </header>
    <form className="filter-bar" method="get">
      <div className="filter-heading">
        <div><h2>Filter jobs</h2><p>Term and work-style filters use the posting text supplied by each employer.</p></div>
        {activeFilterCount > 0 ? <span className="badge">{activeFilterCount} active</span> : null}
      </div>
      <div className="filter-grid">
        <label htmlFor="term">Internship term<select id="term" name="term" defaultValue={term ?? ""}><option value="">All terms</option><option value="fall-2026">Fall 2026</option><option value="winter-2027">Winter 2027</option><option value="summer-2027">Summer 2027</option></select></label>
        <label htmlFor="postedWithin">Job posted<select id="postedWithin" name="postedWithin" defaultValue={postedWithin ?? ""}><option value="">Any date</option><option value="1">Past 24 hours</option><option value="3">Past 3 days</option><option value="7">Past 7 days</option><option value="30">Past 30 days</option></select></label>
        <label htmlFor="workplace">Workplace<select id="workplace" name="workplace" defaultValue={workplace ?? ""}><option value="">Remote or in person</option><option value="remote">Remote</option><option value="in-person">In person / hybrid</option></select></label>
        <label htmlFor="schedule">Schedule<select id="schedule" name="schedule" defaultValue={schedule ?? ""}><option value="">Part time or full time</option><option value="part-time">Part time</option><option value="full-time">Full time</option></select></label>
        <label htmlFor="minimumScore">Minimum score<input id="minimumScore" name="minimumScore" type="number" inputMode="numeric" min="0" max="100" defaultValue={minimumScore || ""} /></label>
        <label htmlFor="state">Status<select id="state" name="state" defaultValue={state ?? ""}><option value="">All statuses</option><option value="discovered">Discovered</option><option value="needs_verification">Needs verification</option><option value="verified">Verified</option><option value="shortlisted">Shortlisted</option><option value="dismissed">Dismissed</option><option value="closed">Closed</option></select></label>
        <label htmlFor="location">Location contains<input id="location" name="location" type="search" defaultValue={location ?? ""} placeholder="Toronto, California…" /></label>
      </div>
      <div className="filter-actions"><button type="submit">Apply filters</button>{activeFilterCount > 0 ? <a className="secondary-action" href="/jobs">Clear filters</a> : null}</div>
    </form>
    {rows.length === 0 ? <p className="empty">No jobs match these filters. Try clearing one or more filters.</p> : <>
      <div className="table-scroll" tabIndex={0} role="region" aria-label="Filtered jobs table">
        <table className="data-table"><thead><tr><th>Role</th><th>Company</th><th>Location</th><th>Posted</th><th>Score</th><th>Status</th><th>Reference</th><th><span className="sr-only">Save for later</span></th></tr></thead><tbody>{rows.map(job => <tr key={job.id}><td><Link href={`/jobs/${job.id}`}><strong>{job.title}</strong></Link></td><td>{formatCompanyName(job.companies)}</td><td>{job.location_text ?? "Not listed"}</td><td><time dateTime={job.posted_at ?? undefined}>{formatDate(job.posted_at)}</time></td><td>{Number(job.preliminary_score)}/100</td><td><span className="badge">{job.state.replaceAll("_", " ")}</span></td><td><AppliedJobButton jobId={Number(job.id)} title={job.title} appliedAt={job.applied_at ?? null} /></td><td><SaveJobButton jobId={Number(job.id)} title={job.title} savedAt={job.saved_at ?? null} /></td></tr>)}</tbody></table>
      </div>
      {hasNext && nextCursor ? <nav className="pagination" aria-label="Jobs pagination"><Link className="primary-action" href={`/jobs?${nextQuery.toString()}`}>Next page</Link></nav> : null}
    </>}
  </>;
}
