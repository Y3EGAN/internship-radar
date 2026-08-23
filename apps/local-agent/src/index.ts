import { runCli } from "./cli";

export const FINAL_SUBMIT_AUTOMATION_ENABLED = false as const;

if (process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js")) {
  runCli(process.argv.slice(2)).catch((error:unknown)=>{
    process.stderr.write(`${error instanceof Error ? error.message : "Local companion failed"}\n`);
    process.exitCode=1;
  });
}

export * from "./planner";
