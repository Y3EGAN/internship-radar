import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { LocalQueue } from "./queue";

describe("durable local queue",()=>{it("atomically upserts state by application",()=>{const queue=new LocalQueue(join(mkdtempSync(join(tmpdir(),"radar-queue-")),"queue.json"));const base={applicationId:"fixture",url:"https://jobs.example.invalid/1",platform:"generic",state:"queued" as const,payload:{}};queue.upsert(base);queue.upsert({...base,state:"paused",pauseReason:"fixture"});expect(queue.list()).toEqual([{...base,state:"paused",pauseReason:"fixture"}]);});});
