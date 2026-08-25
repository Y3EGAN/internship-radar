import { notFound } from "next/navigation";
import { requireOwner } from "../../../../lib/auth";
import { formatCompanyName, formatDate } from "../../../../lib/job-presentation";
import { SaveJobButton } from "../../_components/save-job-button";
import { queuePreparation } from "./actions";

export default async function JobPage({ params }: { readonly params: Promise<{ id:string }> }) {
  const { id } = await params;
  const { client } = await requireOwner();
  const { data } = await client.from("jobs").select("id,title,description,location_text,state,preliminary_score,canonical_url,posted_at,closes_at,saved_at,companies(name)").eq("id",id).maybeSingle();
  if (!data) notFound();
  const verified = data.state === "verified";
  const company = formatCompanyName(data.companies);
  return <><header className="page-header"><div><p className="eyebrow">JOB / {data.id}</p><h1>{data.title}</h1><p className="header-company">{company}</p></div><div className="header-actions"><span className="badge">{data.state}</span><SaveJobButton jobId={Number(data.id)} title={data.title} savedAt={data.saved_at??null}/></div></header><section className="panel-grid"><article className="panel"><h2>Posting</h2><dl className="posting-facts"><div><dt>Location</dt><dd>{data.location_text??"Not listed"}</dd></div><div><dt>Posted</dt><dd>{formatDate(data.posted_at)}</dd></div><div><dt>Closes</dt><dd>{formatDate(data.closes_at)}</dd></div><div><dt>Score</dt><dd>{Number(data.preliminary_score)}/100</dd></div></dl><p>{data.description??"No description captured."}</p><a className="primary-action" href={data.canonical_url??"#"}>Open verified posting</a></article><article className="panel priority-panel"><h2>Application</h2><p>Preparation remains user-triggered and never submits automatically.</p><form action={queuePreparation}><input type="hidden" name="jobId" value={data.id}/><label className="check-label"><input type="checkbox" name="coverLetter"/> Include a cover letter</label><button className="primary-action" type="submit" disabled={!verified} title={verified?undefined:"The posting must be verified before preparation"}>Prepare application</button></form></article></section></>;
}
