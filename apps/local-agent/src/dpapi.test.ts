import { mkdtempSync,readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { DpapiTokenStore } from "./dpapi";

describe("DPAPI token storage",()=>{
  it.runIf(process.platform==="win32"&&process.env.RADAR_TEST_DPAPI==="1")("round-trips without writing plaintext",()=>{const path=join(mkdtempSync(join(tmpdir(),"radar-dpapi-")),"token");const store=new DpapiTokenStore(path);const token="fixture-local-device-token";store.save(token);expect(readFileSync(path,"utf8")).not.toContain(token);expect(store.load()).toBe(token);});
});
