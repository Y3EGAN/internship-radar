import { NextResponse } from "next/server";
import { rejectUnauthorizedCodex } from "../../../../../../lib/codex-route";
import { createServiceClient } from "../../../../../../lib/service-client";

type Artifact = { kind: "resume_docx"|"resume_pdf"|"cover_docx"|"cover_pdf"; contentBase64: string };
type Body = { ownerId?: string; artifacts?: Artifact[]; answerManifest?: Record<string,unknown>; evidenceManifest?: unknown[] };
const fileNames: Record<Artifact["kind"],string> = { resume_docx:"resume.docx",resume_pdf:"resume.pdf",cover_docx:"cover-letter.docx",cover_pdf:"cover-letter.pdf" };

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectUnauthorizedCodex(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null) as Body | null;
  if (!body?.ownerId || !/^[0-9a-f-]{36}$/i.test(body.ownerId) || !Array.isArray(body.artifacts) || !body.artifacts.some(item=>item.kind==="resume_docx") || !body.artifacts.some(item=>item.kind==="resume_pdf") || !Array.isArray(body.evidenceManifest) || !body.answerManifest) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const { id } = await params;
  const client = createServiceClient();
  const uploaded: string[] = [];
  try {
    for (const artifact of body.artifacts) {
      if (!(artifact.kind in fileNames) || typeof artifact.contentBase64 !== "string") throw new Error("invalid_artifact");
      const bytes = Buffer.from(artifact.contentBase64, "base64");
      if (bytes.length === 0 || bytes.length > 5_000_000) throw new Error("invalid_artifact_size");
      const path = `${body.ownerId}/${id}/${fileNames[artifact.kind]}`;
      const { error } = await client.storage.from("application-documents").upload(path, bytes, { contentType: artifact.kind.endsWith("pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: false });
      if (error) throw error;
      uploaded.push(path);
    }
    const resumePath = `${body.ownerId}/${id}/resume.docx`;
    const coverPath = body.artifacts.some(item=>item.kind==="cover_docx") ? `${body.ownerId}/${id}/cover-letter.docx` : null;
    const answerManifest = { ...body.answerManifest, artifactPaths: uploaded };
    const { data, error } = await client.rpc("record_application_package", { p_application_id:id,p_resume_path:resumePath,p_cover_letter_path:coverPath,p_answer_manifest:answerManifest,p_evidence_manifest:body.evidenceManifest });
    if (error) throw error;
    return NextResponse.json({ packageId:data }, { status: 201 });
  } catch {
    if (uploaded.length) await client.storage.from("application-documents").remove(uploaded);
    return NextResponse.json({ error: "package_rejected" }, { status: 409 });
  }
}
