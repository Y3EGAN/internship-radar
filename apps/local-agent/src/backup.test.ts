import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEncryptedDatabaseBackup, encryptedBackupFormat } from "./backup";
import { DpapiTokenStore } from "./dpapi";

describe("encrypted database backup", () => {
  it.runIf(process.platform === "win32" && process.env.RADAR_TEST_DPAPI === "1")(
    "streams a dump into authenticated ciphertext with a DPAPI-protected key",
    async () => {
      const path = join(mkdtempSync(join(tmpdir(), "radar-backup-")), "fixture.dump.enc");
      await createEncryptedDatabaseBackup(path, "postgresql://fixture.invalid/database", {
        executable: process.execPath,
        args: ["-e", "process.stdout.write('sanitized-database-fixture')"],
      });
      const encrypted = readFileSync(path);
      expect(encrypted.subarray(0, 8).toString("ascii")).toBe(encryptedBackupFormat.magic);
      expect(encrypted.toString("utf8")).not.toContain("sanitized-database-fixture");
      expect(Buffer.from(new DpapiTokenStore(`${path}.key.dpapi`).load(), "base64")).toHaveLength(32);
    },
  );
});
