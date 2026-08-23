import { describe,expect,it } from "vitest";
import { detectPlatform,planFormFill,type Control,type Platform } from "./planner";

const controls:Control[]=[
  {index:0,label:"First name",type:"text",required:true},
  {index:1,label:"Last name",type:"text",required:true},
  {index:2,label:"Email",type:"email",required:true},
  {index:3,label:"Resume",type:"file",required:true},
];
const profile={firstName:"Sample",lastName:"Candidate",email:"candidate@example.invalid"};

describe("review-only ATS form planning",()=>{
  for(const platform of ["greenhouse","lever","ashby"] as Platform[])it(`${platform} fixture reaches review state`,()=>expect(planFormFill(platform,controls,profile,{},"C:\\fixture\\resume.docx")).toMatchObject({state:"review_ready",actions:{length:4}}));
  it("pauses on an unanswered sensitive question",()=>expect(planFormFill("greenhouse",[...controls,{index:4,label:"Will you require sponsorship?",type:"text",required:true}],profile,{},"resume.docx")).toMatchObject({state:"paused",reason:"sensitive_or_ambiguous_question"}));
  it("pauses on an unknown required field",()=>expect(planFormFill("lever",[...controls,{index:4,label:"Secret fixture code",type:"text",required:true}],profile,{},"resume.docx")).toMatchObject({state:"paused",reason:"unknown_required_field"}));
  for(const platform of ["workday","smartrecruiters","icims"] as Platform[])it(`${platform} remains an assisted flow`,()=>expect(planFormFill(platform,controls,profile,{},"resume.docx")).toMatchObject({state:"paused",reason:"assisted_multi_page_flow"}));
  it("detects supported platforms by canonical host",()=>{expect(detectPlatform("https://boards.greenhouse.io/example/jobs/1")).toBe("greenhouse");expect(detectPlatform("https://jobs.lever.co/example/1")).toBe("lever");expect(detectPlatform("https://jobs.ashbyhq.com/example/1")).toBe("ashby");});
  it("has no final-submit action type",()=>expect(planFormFill("greenhouse",controls,profile,{},"resume.docx").actions.every(action=>["fill","select","upload"].includes(action.kind))).toBe(true));
});
