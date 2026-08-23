"use server";
import { redirect } from "next/navigation";
import { requireOwner } from "../../../../lib/auth";

export async function queuePreparation(formData: FormData) {
  const jobId = Number(formData.get("jobId"));
  if (!Number.isSafeInteger(jobId) || jobId <= 0) redirect("/jobs");
  const { client } = await requireOwner();
  const { data, error } = await client.rpc("queue_application_preparation", { p_job_id: jobId, p_cover_letter_requested: formData.get("coverLetter") === "on" });
  if (error || !data) redirect(`/jobs/${jobId}?error=not-queueable`);
  redirect(`/applications/${data}`);
}
