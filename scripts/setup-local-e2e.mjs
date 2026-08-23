const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || !url.startsWith("http://127.0.0.1:")) throw new Error("Local Supabase URL and service key are required");

const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=representation" };
async function request(path, body) {
  const response = await fetch(new URL(path, url), { method: "POST", headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Sanitized local fixture setup failed at ${path}`);
  return response.json();
}

const email = `owner-e2e-${Date.now()}@example.invalid`;
const password = "Fixture-Only-Password-2026!";
const user = await request("/auth/v1/admin/users", { email, password, email_confirm: true });
const ownerId = user.id;
await request("/rest/v1/profiles", { owner_id: ownerId });
const [company] = await request("/rest/v1/companies", {
  owner_id: ownerId, name: "E2E Robotics", tier: "A", priority: 100, career_url: "https://jobs.example.invalid/e2e",
});
const [job] = await request("/rest/v1/jobs", {
  owner_id: ownerId, company_id: company.id, title: "Robotics Software Intern", normalized_title: "robotics software intern",
  canonical_url: "https://jobs.example.invalid/e2e/robotics-intern", description: "Sanitized browser fixture.",
  location_text: "Toronto, ON", normalized_location: "toronto on", role_family: "robotics", state: "verified", preliminary_score: 92,
});
const [application] = await request("/rest/v1/applications", { owner_id: ownerId, job_id: job.id, state: "not_started" });
process.stdout.write(`${JSON.stringify({ ownerId, email, password, jobId: job.id, applicationId: application.id })}\n`);
