import { readFileSync } from "node:fs";
import { join } from "node:path";

const expectedSkills = new Map([
  ["internship-application-preparer", ["needs_input", "must not open application forms"]],
  ["internship-source-adapter", ["eight-second request timeout", "sanitized fixtures"]],
  ["github-actions-poller-operations", ["cancel-in-progress: false", "pull_request_target"]],
  ["public-repo-privacy-review", ["NEXT_PUBLIC_", "complete Git history"]],
]);

for (const [name, requiredText] of expectedSkills) {
  const file = join(".agents", "skills", name, "SKILL.md");
  const source = readFileSync(file, "utf8");
  const frontmatter = new RegExp(`^---\\r?\\nname: ${name}\\r?\\ndescription: .+\\r?\\n---`, "u");

  if (!frontmatter.test(source)) {
    throw new Error(`${file} has invalid or incomplete frontmatter`);
  }

  for (const text of requiredText) {
    if (!source.includes(text)) throw new Error(`${file} is missing required invariant: ${text}`);
  }
}

console.log(`Validated ${expectedSkills.size} project skills.`);
