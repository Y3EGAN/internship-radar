import { notFound } from "next/navigation";
import { requireOwner } from "../../../../lib/auth";

export default async function ApplicationPage({params}:{readonly params:Promise<{id:string}>}) {
  const {id}=await params;
  const {client}=await requireOwner();
  const {data}=await client.from("applications").select("id,state,notes,created_at,jobs(title),application_events(event_type,created_at),application_packages(id,state,resume_path,cover_letter_path)").eq("id",id).maybeSingle();
  if(!data) notFound();
  const packages = (data.application_packages ?? []) as Array<{id:string;state:string;resume_path:string|null;cover_letter_path:string|null}>;
  const documents = packages.flatMap(pkg => [{label:"Resume",path:pkg.resume_path},{label:"Cover letter",path:pkg.cover_letter_path}]);
  const documentLinks = await Promise.all(documents.map(async ({label,path}) => {
    if (!path) return null;
    const {data:signed}=await client.storage.from("application-documents").createSignedUrl(path,60);
    return signed?.signedUrl ? {label,url:signed.signedUrl} : null;
  }));
  const validLinks = documentLinks.flatMap(link => link ? [link] : []);
  return <><header className="page-header"><div><p className="eyebrow">APPLICATION / {data.id}</p><h1>{(data.jobs as {title?:string}|null)?.title??"Application"}</h1></div><span className="badge">{data.state}</span></header><section className="panel-grid"><article className="panel"><h2>Event history</h2><p>{data.notes??"No notes yet."}</p><p>Package preparation stops for unknown or sensitive answers.</p></article><article className="panel"><h2>Private documents</h2>{validLinks.length?<ul>{validLinks.map(link=><li key={link.url}><a href={link.url}>{link.label} (link expires in 60 seconds)</a></li>)}</ul>:<p>No package documents are ready.</p>}</article></section></>;
}
