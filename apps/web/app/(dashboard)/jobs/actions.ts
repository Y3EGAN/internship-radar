"use server";
import { revalidatePath } from "next/cache";
import { requireOwner } from "../../../lib/auth";
import { parseSaveJobInput } from "../../../lib/job-presentation";

export async function setJobSaved(formData: FormData): Promise<void> {
  const input = parseSaveJobInput(formData.get("jobId"), formData.get("saved"));
  if (input === null) return;
  const { client, user } = await requireOwner();
  await client
    .from("jobs")
    .update({ saved_at: input.saved ? new Date().toISOString() : null })
    .eq("id", input.jobId)
    .eq("owner_id", user.id);
  revalidatePath("/jobs");
  revalidatePath("/saved");
  revalidatePath(`/jobs/${input.jobId}`);
}
