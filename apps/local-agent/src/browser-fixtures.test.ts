import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { describe,expect,it } from "vitest";
import { fillPage } from "./browser";
import type { Platform } from "./planner";

const html=`<!doctype html><form onsubmit="document.body.dataset.submitted='true';return false"><label>First name<input name="first" required></label><label>Last name<input name="last" required></label><label>Email<input name="email" type="email" required></label><label>Resume<input name="resume" type="file" required></label><button type="submit">Submit application</button></form>`;

describe.runIf(process.env.RADAR_BROWSER_FIXTURES==="1")("real Chrome ATS fixtures",()=>{
  for(const platform of ["greenhouse","lever","ashby"] as Platform[])it(`${platform} fills to review without submitting`,async()=>{const browser=await chromium.launch({channel:"chrome",headless:true});try{const page=await browser.newPage();await page.setContent(html);const resume=join(tmpdir(),`radar-${platform}-resume.docx`);writeFileSync(resume,"fixture");const result=await fillPage(page,{platform,profile:{firstName:"Sample",lastName:"Candidate",email:"candidate@example.invalid"},answers:{},resumePath:resume});expect(result).toMatchObject({state:"review_ready",fieldCount:4});expect(await page.locator('input[name="first"]').inputValue()).toBe("Sample");expect(await page.evaluate(()=>document.body.dataset.submitted)).toBeUndefined();}finally{await browser.close();}});
});
