import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const binary = resolve("node_modules", "supabase", "dist", "supabase.js");
const arguments_ = ["gen", "types", "--local", "--schema", "public"];
const output = execFileSync(process.execPath, [binary, ...arguments_], { encoding: "utf8" });
const marker = "export type Json";
const generated = output.slice(output.indexOf(marker)).replaceAll("\r\n", "\n").trim();
const stored = readFileSync("packages/core/src/database.types.ts", "utf8")
  .replaceAll("\r\n", "\n")
  .trim();

if (!generated.startsWith(marker)) throw new Error("Supabase type generation returned no TypeScript schema");
if (generated !== stored) throw new Error("Generated database types do not match the local schema");

console.log("Generated database types match the local schema.");
