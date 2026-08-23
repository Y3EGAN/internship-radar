import { chromium, type Page } from "playwright";
import { planFormFill,type Platform,type Control } from "./planner";

export async function fillApplication(input:{url:string;platform:Platform;profile:Record<string,string>;answers:Record<string,string>;resumePath:string;profileDirectory:string}){
  const context=await chromium.launchPersistentContext(input.profileDirectory,{channel:"chrome",headless:false});
  try{
    const page=context.pages()[0]??await context.newPage();await page.goto(input.url,{waitUntil:"domcontentloaded"});
    return await fillPage(page,input);
  }finally{await context.close();}
}

export async function fillPage(page:Page,input:{platform:Platform;profile:Record<string,string>;answers:Record<string,string>;resumePath:string}){
  if(await hasCaptcha(page))return{state:"paused" as const,reason:"captcha_or_login_required",fieldCount:0};
  const locator=page.locator("input,textarea,select");
  const controls=await locator.evaluateAll((elements)=>elements.map((element,index)=>{const input=element as HTMLInputElement;const id=input.id;const explicit=id?document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent:"";const wrapping=input.closest("label")?.textContent;return{index,label:(input.getAttribute("aria-label")||explicit||wrapping||input.name||"").trim(),type:input.type||input.tagName.toLowerCase(),required:input.required||input.getAttribute("aria-required")==="true"};})) as Control[];
  const plan=planFormFill(input.platform,controls,input.profile,input.answers,input.resumePath);
  for(const action of plan.actions){const target=locator.nth(action.index);if(action.kind==="upload")await target.setInputFiles(action.value);else if(action.kind==="select")await target.selectOption({label:action.value}).catch(()=>target.selectOption(action.value));else await target.fill(action.value);}
  return{state:plan.state,reason:plan.reason,fieldCount:plan.actions.length};
}

async function hasCaptcha(page:Page){return await page.locator('iframe[src*="captcha" i],iframe[title*="captcha" i]').count()>0||await page.getByText(/captcha|sign in to continue/i).count()>0;}
