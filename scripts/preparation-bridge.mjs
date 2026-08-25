import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_URL = "https://internship-radar-web-omega.vercel.app";
const CONFIG_FILE = "preparation-bridge.json";
const TOKEN_FILE = "codex-preparation-token.dpapi";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ARTIFACT_BYTES = 5_000_000;

function localRoot() {
  return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "InternshipRadar");
}

function powershellPath() {
  return join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
}

function encoded(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function assertHttpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new Error("Preparation bridge URL must use HTTPS");
  }
  return url.origin;
}

function writePrivateJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function promptForProtectedToken() {
  if (process.platform !== "win32") throw new Error("Preparation credentials require Windows DPAPI");
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$s=Read-Host 'Enter CODEX_PREPARATION_TOKEN' -AsSecureString",
    "$p=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)",
    "try {",
    "  $v=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($p)",
    "  if ([Text.Encoding]::UTF8.GetByteCount($v) -lt 32) { throw 'Token must contain at least 32 bytes' }",
    "  $b=[Text.Encoding]::UTF8.GetBytes($v)",
    "  $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "  [Console]::Out.Write([Convert]::ToBase64String($e))",
    "} finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }",
  ].join("\n");
  return execFileSync(powershellPath(), ["-NoProfile", "-EncodedCommand", encoded(script)], {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
    windowsHide: false,
  }).trim();
}

function protectToken(token) {
  if (process.platform !== "win32") throw new Error("Preparation credentials require Windows DPAPI");
  if (Buffer.byteLength(token, "utf8") < 32) throw new Error("Preparation token must contain at least 32 bytes");
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$v=[Console]::In.ReadToEnd()",
    "$b=[Text.Encoding]::UTF8.GetBytes($v)",
    "$e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Convert]::ToBase64String($e))",
  ].join(";");
  return execFileSync(
    powershellPath(),
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded(script)],
    { input: token, encoding: "utf8", windowsHide: true },
  ).trim();
}

function unprotectToken(ciphertext) {
  if (process.platform !== "win32") throw new Error("Preparation credentials require Windows DPAPI");
  const script = [
    "Add-Type -AssemblyName System.Security",
    "$v=[Console]::In.ReadToEnd()",
    "$e=[Convert]::FromBase64String($v)",
    "$b=[Security.Cryptography.ProtectedData]::Unprotect($e,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)",
    "[Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))",
  ].join(";");
  const token = execFileSync(
    powershellPath(),
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded(script)],
    { input: ciphertext, encoding: "utf8", windowsHide: true },
  );
  if (Buffer.byteLength(token, "utf8") < 32) throw new Error("Stored preparation credential is invalid");
  return token;
}

function readConfiguration(root) {
  const configPath = join(root, CONFIG_FILE);
  const tokenPath = join(root, TOKEN_FILE);
  if (!existsSync(configPath) || !existsSync(tokenPath)) return null;
  const value = JSON.parse(readFileSync(configPath, "utf8"));
  if (typeof value.baseUrl !== "string" || typeof value.baseResumePath !== "string") {
    throw new Error("Preparation bridge configuration is invalid");
  }
  if (!existsSync(value.baseResumePath)) throw new Error("Configured private base resume is unavailable");
  return {
    baseUrl: assertHttpsUrl(value.baseUrl),
    baseResumePath: resolve(value.baseResumePath),
    token: unprotectToken(readFileSync(tokenPath, "utf8")),
  };
}

function pendingWorkspace(root) {
  const applicationsRoot = join(root, "preparation");
  if (!existsSync(applicationsRoot)) return null;
  for (const entry of readdirSync(applicationsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !UUID.test(entry.name)) continue;
    const workspace = join(applicationsRoot, entry.name);
    if (existsSync(join(workspace, "claim.json"))) return workspace;
  }
  return null;
}

function safeWorkspace(root, applicationId) {
  if (!UUID.test(applicationId)) throw new Error("Application identifier is invalid");
  const applicationsRoot = resolve(join(root, "preparation"));
  const workspace = resolve(join(applicationsRoot, applicationId));
  if (dirname(workspace) !== applicationsRoot) throw new Error("Application workspace is invalid");
  return workspace;
}

function authenticatedHeaders(token) {
  return { authorization: `Bearer ${token}`, "content-type": "application/json" };
}

async function checkedJson(response, expectedStatus) {
  if (response.status !== expectedStatus) throw new Error(`Preparation API request failed (${response.status})`);
  return response.json();
}

export async function claimNext({ root, baseUrl, token, baseResumePath, fetchImpl = fetch }) {
  const pending = pendingWorkspace(root);
  if (pending) return { state: "resume", workspace: pending };
  const response = await fetchImpl(new URL("/api/codex/preparation/next", baseUrl), {
    headers: { ...authenticatedHeaders(token), "x-worker-id": "codex-heartbeat-local" },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 204) return { state: "idle" };
  const body = await checkedJson(response, 200);
  const preparation = body?.preparation;
  const applicationId = preparation?.application_id;
  const ownerId = preparation?.owner_id;
  if (!UUID.test(applicationId ?? "") || !UUID.test(ownerId ?? "") || typeof preparation.job !== "object") {
    throw new Error("Preparation API returned an invalid claim");
  }
  const workspace = safeWorkspace(root, applicationId);
  mkdirSync(workspace, { recursive: true });
  writePrivateJson(join(workspace, "claim.json"), { ...preparation, local_base_resume_path: resolve(baseResumePath) });
  return { state: "claimed", workspace };
}

function readManifest(workspace) {
  const path = join(workspace, "package.json");
  if (!existsSync(path)) throw new Error("Verified package manifest is missing");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (!manifest?.answerManifest || typeof manifest.answerManifest !== "object") {
    throw new Error("Answer manifest is invalid");
  }
  if (!Array.isArray(manifest.evidenceManifest) || manifest.evidenceManifest.length === 0) {
    throw new Error("Evidence manifest is invalid");
  }
  for (const claim of manifest.evidenceManifest) {
    if (!Array.isArray(claim?.evidenceIds) || claim.evidenceIds.length === 0) {
      throw new Error("Every material claim requires evidence identifiers");
    }
  }
  return manifest;
}

function readArtifact(workspace, fileName, kind, required) {
  const path = join(workspace, fileName);
  if (!existsSync(path)) {
    if (required) throw new Error(`Required ${kind} artifact is missing`);
    return null;
  }
  const size = statSync(path).size;
  if (size === 0 || size > MAX_ARTIFACT_BYTES) throw new Error(`${kind} artifact size is invalid`);
  return { kind, contentBase64: readFileSync(path).toString("base64") };
}

function archiveClaim(workspace, outcome) {
  const source = join(workspace, "claim.json");
  if (existsSync(source)) renameSync(source, join(workspace, `${outcome}-claim.json`));
  writePrivateJson(join(workspace, "result.json"), { outcome, completedAt: new Date().toISOString() });
}

export async function completePackage({ root, baseUrl, token, applicationId, fetchImpl = fetch }) {
  const workspace = safeWorkspace(root, applicationId);
  const claim = JSON.parse(readFileSync(join(workspace, "claim.json"), "utf8"));
  const manifest = readManifest(workspace);
  const artifacts = [
    readArtifact(workspace, "resume.docx", "resume_docx", true),
    readArtifact(workspace, "resume.pdf", "resume_pdf", true),
    readArtifact(workspace, "cover-letter.docx", "cover_docx", false),
    readArtifact(workspace, "cover-letter.pdf", "cover_pdf", false),
  ].filter(Boolean);
  const hasCoverDocx = artifacts.some((item) => item.kind === "cover_docx");
  const hasCoverPdf = artifacts.some((item) => item.kind === "cover_pdf");
  if (hasCoverDocx !== hasCoverPdf) throw new Error("Cover letter DOCX and PDF must be provided together");
  const response = await fetchImpl(new URL(`/api/codex/preparation/${applicationId}/package`, baseUrl), {
    method: "POST",
    headers: authenticatedHeaders(token),
    signal: AbortSignal.timeout(30_000),
    body: JSON.stringify({
      ownerId: claim.owner_id,
      artifacts,
      answerManifest: manifest.answerManifest,
      evidenceManifest: manifest.evidenceManifest,
    }),
  });
  await checkedJson(response, 201);
  archiveClaim(workspace, "package-ready");
  return { state: "package_ready" };
}

export async function recordNeedsInput({ root, baseUrl, token, applicationId, fetchImpl = fetch }) {
  const workspace = safeWorkspace(root, applicationId);
  const questionsPath = join(workspace, "questions.json");
  if (!existsSync(join(workspace, "claim.json")) || !existsSync(questionsPath)) {
    throw new Error("Claim or questions file is missing");
  }
  const questions = JSON.parse(readFileSync(questionsPath, "utf8"));
  if (!Array.isArray(questions) || questions.length === 0) throw new Error("At least one unresolved question is required");
  for (const question of questions) {
    if (typeof question?.fingerprint !== "string" || typeof question?.prompt !== "string") {
      throw new Error("Unresolved question format is invalid");
    }
  }
  const response = await fetchImpl(new URL(`/api/codex/preparation/${applicationId}/fail`, baseUrl), {
    method: "POST",
    headers: authenticatedHeaders(token),
    signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ questions, errorCode: "owner_input_required" }),
  });
  if (response.status !== 204) throw new Error(`Preparation API request failed (${response.status})`);
  archiveClaim(workspace, "needs-input");
  return { state: "needs_input" };
}

function configurationArguments(arguments_) {
  const resumeIndex = arguments_.indexOf("--resume");
  const urlIndex = arguments_.indexOf("--url");
  const resume = resumeIndex >= 0 ? arguments_[resumeIndex + 1] : "";
  const baseUrl = urlIndex >= 0 ? arguments_[urlIndex + 1] : DEFAULT_URL;
  if (!resume || !existsSync(resume)) throw new Error("Usage: preparation-bridge configure --resume <private-resume-path> [--url <site-url>]");
  return { resume, baseUrl: assertHttpsUrl(baseUrl) };
}

function saveConfiguration(root, resume, baseUrl, protectedToken) {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, TOKEN_FILE), protectedToken, { encoding: "utf8", mode: 0o600 });
  writePrivateJson(join(root, CONFIG_FILE), { baseUrl, baseResumePath: resolve(resume) });
  return { state: "configured", resume: basename(resume) };
}

function configure(root, arguments_) {
  const { resume, baseUrl } = configurationArguments(arguments_);
  return saveConfiguration(root, resume, baseUrl, promptForProtectedToken());
}

function configureFromEnvironment(root, arguments_) {
  const { resume, baseUrl } = configurationArguments(arguments_);
  const token = process.env.CODEX_PREPARATION_TOKEN ?? "";
  try {
    return saveConfiguration(root, resume, baseUrl, protectToken(token));
  } finally {
    delete process.env.CODEX_PREPARATION_TOKEN;
  }
}

function rotateVercelCredential(root, arguments_) {
  const { resume, baseUrl } = configurationArguments(arguments_);
  const cwdIndex = arguments_.indexOf("--vercel-cwd");
  const vercelCwd = cwdIndex >= 0 ? resolve(arguments_[cwdIndex + 1] ?? "") : "";
  const projectFile = vercelCwd ? join(vercelCwd, ".vercel", "project.json") : "";
  if (!projectFile || !existsSync(projectFile)) throw new Error("A linked Vercel project directory is required");
  const project = JSON.parse(readFileSync(projectFile, "utf8"));
  if (project.projectName !== "internship-radar-web") throw new Error("Refusing to update an unexpected Vercel project");
  let token = randomBytes(48).toString("base64url");
  try {
    const npxCli = join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
    if (!existsSync(npxCli)) throw new Error("Vercel CLI launcher is unavailable");
    execFileSync(
      process.execPath,
      [
        npxCli,
        "--yes",
        "vercel@latest",
        "env",
        "update",
        "CODEX_PREPARATION_TOKEN",
        "production",
        "--sensitive",
        "--yes",
        "--cwd",
        vercelCwd,
      ],
      { cwd: vercelCwd, input: token, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], windowsHide: true, timeout: 120_000 },
    );
    return saveConfiguration(root, resume, baseUrl, protectToken(token));
  } catch {
    throw new Error("Vercel preparation credential update failed");
  } finally {
    token = "";
  }
}

async function run() {
  const [command, ...arguments_] = process.argv.slice(2);
  const root = localRoot();
  if (command === "configure") {
    process.stdout.write(`${JSON.stringify(configure(root, arguments_))}\n`);
    return;
  }
  if (command === "configure-env") {
    process.stdout.write(`${JSON.stringify(configureFromEnvironment(root, arguments_))}\n`);
    return;
  }
  if (command === "rotate-vercel") {
    process.stdout.write(`${JSON.stringify(rotateVercelCredential(root, arguments_))}\n`);
    return;
  }
  const configuration = readConfiguration(root);
  if (!configuration) {
    process.stdout.write(`${JSON.stringify({ state: "configuration_required" })}\n`);
    process.exitCode = 2;
    return;
  }
  if (command === "status") {
    process.stdout.write(`${JSON.stringify({ state: "configured", pending: Boolean(pendingWorkspace(root)) })}\n`);
    return;
  }
  if (command === "next") {
    process.stdout.write(`${JSON.stringify(await claimNext({ root, ...configuration }))}\n`);
    return;
  }
  if (command === "complete") {
    const applicationId = arguments_[0];
    process.stdout.write(`${JSON.stringify(await completePackage({ root, ...configuration, applicationId }))}\n`);
    return;
  }
  if (command === "needs-input") {
    const applicationId = arguments_[0];
    process.stdout.write(`${JSON.stringify(await recordNeedsInput({ root, ...configuration, applicationId }))}\n`);
    return;
  }
  throw new Error("Commands: configure --resume <path> [--url <url>] | status | next | complete <application-id> | needs-input <application-id>");
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Preparation bridge failed"}\n`);
    process.exitCode = 1;
  });
}
