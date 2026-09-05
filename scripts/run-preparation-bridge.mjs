import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, posix, resolve, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultConfigPath = join(repositoryRoot, "tmp", "preparation-bridge.local.json");

export function readRunnerConfiguration(path = defaultConfigPath) {
  if (!existsSync(path)) return null;
  const value = JSON.parse(readFileSync(path, "utf8"));
  for (const key of ["baseResumePath", "preparationRoot", "vercelCwd"]) {
    if (typeof value[key] !== "string" || !value[key]) throw new Error("Preparation runner configuration is invalid");
  }
  if (!existsSync(value.baseResumePath) || !existsSync(join(value.vercelCwd, ".vercel", "project.json"))) {
    throw new Error("Preparation runner private prerequisites are unavailable");
  }
  const project = JSON.parse(readFileSync(join(value.vercelCwd, ".vercel", "project.json"), "utf8"));
  if (project.projectName !== "internship-radar-web") throw new Error("Refusing to use an unexpected Vercel project");
  return {
    baseResumePath: resolve(value.baseResumePath),
    preparationRoot: resolve(value.preparationRoot),
    vercelCwd: resolve(value.vercelCwd),
    baseUrl: typeof value.baseUrl === "string" ? new URL(value.baseUrl).origin : "https://internship-radar-web-omega.vercel.app",
  };
}

export function buildRunnerInvocation(configuration, command, arguments_ = [], runtime = {
  executable: process.execPath,
  platform: process.platform,
  pathExists: existsSync,
}) {
  const pathApi = runtime.platform === "win32" ? win32 : posix;
  const npxExecutable = pathApi.join(
    pathApi.dirname(runtime.executable),
    runtime.platform === "win32" ? "npx.cmd" : "npx",
  );
  if (!runtime.pathExists(npxExecutable)) throw new Error("Vercel CLI launcher is unavailable");
  return {
    executable: npxExecutable,
    arguments: [
      "--yes",
      "vercel@latest",
      "env",
      "run",
      "--environment",
      "development",
      "--cwd",
      configuration.vercelCwd,
      "--",
      runtime.executable,
      join(repositoryRoot, "scripts", "preparation-bridge.mjs"),
      command,
      ...arguments_,
    ],
    environment: {
      ...process.env,
      RADAR_BASE_RESUME: configuration.baseResumePath,
      RADAR_PREPARATION_ROOT: configuration.preparationRoot,
      RADAR_URL: configuration.baseUrl,
    },
  };
}

function sanitizedResult(output) {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const value = JSON.parse(lines[index]);
      if (typeof value?.state === "string") return value;
    } catch {
      // Vercel CLI status lines are intentionally discarded.
    }
  }
  throw new Error("Preparation bridge returned no sanitized status");
}

async function run() {
  const [command, ...arguments_] = process.argv.slice(2);
  const configuration = readRunnerConfiguration();
  if (!configuration) {
    process.stdout.write(`${JSON.stringify({ state: "configuration_required" })}\n`);
    process.exitCode = 2;
    return;
  }
  const invocation = buildRunnerInvocation(configuration, command, arguments_);
  try {
    const output = execFileSync(invocation.executable, invocation.arguments, {
      cwd: repositoryRoot,
      env: invocation.environment,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      timeout: 180_000,
    });
    process.stdout.write(`${JSON.stringify(sanitizedResult(output))}\n`);
  } catch {
    throw new Error("Authenticated preparation runner failed");
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Preparation runner failed"}\n`);
    process.exitCode = 1;
  });
}
