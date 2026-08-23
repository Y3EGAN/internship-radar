import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, rmSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { createCipheriv } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { DpapiTokenStore } from "./dpapi";

const MAGIC = Buffer.from("IRDBK001", "ascii");

/**
 * Streams a custom-format pg_dump through AES-256-GCM. The random AES key is
 * separately protected with Windows DPAPI, so neither database bytes nor the
 * decryption key are ever written in plaintext.
 */
export async function createEncryptedDatabaseBackup(
  destination: string,
  databaseUrl: string,
  dumpCommand: { readonly executable: string; readonly args: readonly string[] } = {
    executable: "pg_dump",
    args: ["--format=custom", "--no-owner", "--no-privileges"],
  },
): Promise<void> {
  if (process.platform !== "win32") throw new Error("Encrypted database backup requires Windows DPAPI");
  if (databaseUrl.trim() === "") throw new Error("RADAR_DATABASE_URL is required for radar backup");
  if (existsSync(destination) || existsSync(`${destination}.key.dpapi`)) throw new Error("Backup destination already exists");

  mkdirSync(dirname(destination), { recursive: true });
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const output = createWriteStream(destination, { flags: "wx", mode: 0o600 });
  output.write(Buffer.concat([MAGIC, iv]));

  const dump = spawn(dumpCommand.executable, [...dumpCommand.args], {
    env: { ...process.env, PGDATABASE: databaseUrl },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  dump.stderr.setEncoding("utf8");
  dump.stderr.on("data", (chunk: string) => { stderr = `${stderr}${chunk}`.slice(-4_096); });
  const exit = new Promise<void>((resolve, reject) => {
    dump.once("error", () => reject(new Error("pg_dump could not be started")));
    dump.once("close", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump failed${stderr.trim() ? " with a sanitized diagnostic" : ""}`)));
  });

  try {
    await Promise.all([pipeline(dump.stdout, cipher, output), exit]);
    await appendFile(destination, cipher.getAuthTag(), { mode: 0o600 });
    new DpapiTokenStore(`${destination}.key.dpapi`).save(key.toString("base64"));
  } catch (error) {
    dump.kill();
    rmSync(destination, { force: true });
    rmSync(`${destination}.key.dpapi`, { force: true });
    throw error;
  } finally {
    key.fill(0);
  }
}

export const encryptedBackupFormat = Object.freeze({ magic: MAGIC.toString("ascii"), ivBytes: 12, tagBytes: 16 });
