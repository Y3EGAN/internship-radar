import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "apps", "web", ".next", "static");
const forbidden = ["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "DATABASE_URL"];

async function files(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await files(path));
    else paths.push(path);
  }
  return paths;
}

const paths = await files(root);
for (const path of paths) {
  const contents = await readFile(path, "utf8");
  const match = forbidden.find((token) => contents.includes(token));
  if (match) throw new Error(`Privileged server token name ${match} found in browser artifact ${path}`);
}

console.log(`Browser bundle scan passed (${paths.length} static artifacts).`);
