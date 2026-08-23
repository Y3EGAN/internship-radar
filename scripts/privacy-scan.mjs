import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const forbiddenExtensions = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".dump",
  ".har",
  ".pdf",
  ".p12",
  ".pem",
  ".tsv",
  ".xls",
  ".xlsx",
  ".zip",
]);

const secretPatterns = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ["GitHub token", /gh[pousr]_[A-Za-z0-9_]{30,}/u],
  ["Supabase service-role JWT", /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/u],
  ["Resend API key", /re_[A-Za-z0-9_-]{20,}/u],
];

const piiPatterns = [
  ["North American phone number", /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]\d{3}[-.\s]\d{4}\b/u],
  ["non-fixture email address", /\b(?!(?:onboarding|delivered|bounced|complained)@resend\.dev\b)[A-Z0-9._%+-]+@(?!example\.(?:com|org|net|invalid)\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/iu],
];

const output = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], {
  encoding: "utf8",
});
const files = output.split("\0").filter(Boolean);
const findings = [];

for (const file of files) {
  if (forbiddenExtensions.has(extname(file).toLowerCase())) {
    findings.push(`${file}: forbidden tracked/public artifact type`);
    continue;
  }

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const [label, pattern] of [...secretPatterns, ...piiPatterns]) {
    if (pattern.test(text)) findings.push(`${file}: possible ${label}`);
  }
}

if (findings.length > 0) {
  console.error("Privacy scan failed:\n" + findings.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Privacy scan passed (${files.length} public candidate files checked).`);
}
