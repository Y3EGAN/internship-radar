import { existsSync,mkdirSync,writeFileSync } from "node:fs";
import { join } from "node:path";
import { CompanionApi } from "./api";
import { createEncryptedDatabaseBackup } from "./backup";
import { fillApplication } from "./browser";
import { DpapiTokenStore } from "./dpapi";
import { detectPlatform,type Platform } from "./planner";
import { LocalQueue,type QueueItem } from "./queue";

const root=join(process.env.LOCALAPPDATA??process.cwd(),"InternshipRadar");const tokenPath=join(root,"device-token.dpapi");const queue=new LocalQueue(join(root,"queue.json"));
type PackagePayload={answer_manifest?:{profile?:Record<string,string>;answers?:Record<string,string>;localResumePath?:string}};
type ApplicationResponse={application:{application_id?:string;id?:string;job?:{canonical_url:string};jobs?:{canonical_url:string};package?:PackagePayload;application_packages?:PackagePayload[]};documents?:Array<{path:string;url:string}>};
export async function runCli(arguments_:string[]){const [command,value]=arguments_;const baseUrl=process.env.RADAR_URL??"http://localhost:3000";const tokens=new DpapiTokenStore(tokenPath);
  if(command==="pair"){if(!value)throw new Error("Usage: radar pair <pairing-code>");const paired=await CompanionApi.pair(baseUrl,value);tokens.save(paired.token);process.stdout.write("Device paired. The token is encrypted with Windows DPAPI.\n");return;}
  if(command==="status"){process.stdout.write(JSON.stringify({paired:existsSync(tokenPath),queue:queue.list().map(item=>({applicationId:item.applicationId,state:item.state,pauseReason:item.pauseReason}))},null,2)+"\n");return;}
  if(command==="backup"){const destination=value??join(root,"backups",`database-${new Date().toISOString().replaceAll(':','-')}.dump.enc`);await createEncryptedDatabaseBackup(destination,process.env.RADAR_DATABASE_URL??"");process.stdout.write(`Encrypted database backup written to ${destination}; its AES key is DPAPI-protected at ${destination}.key.dpapi\n`);return;}
  const api=new CompanionApi(baseUrl,tokens.load());
  if(command==="apply"){if(!value)throw new Error("Usage: radar apply <application-id>");const response=await api.get(value);await enqueueResponse(response);await processItem(queue.list().find(item=>item.applicationId===value)!,api);return;}
  if(command==="resume"){const item=queue.list().find(current=>current.state!=="review_ready");if(!item)throw new Error("No queued application to resume");await processItem(item,api);return;}
  throw new Error("Commands: radar pair <code> | status | apply <application-id> | resume | backup [path]");}

async function enqueueResponse(response:ApplicationResponse){const application=response.application;const job=application.job??application.jobs;const applicationId=application.application_id??application.id;if(!job||!applicationId)throw new Error("Application payload is incomplete");const resume=response.documents?.find(document=>document.path.endsWith("resume.docx"));if(resume){const artifactDirectory=join(root,"artifacts",applicationId);mkdirSync(artifactDirectory,{recursive:true});const target=join(artifactDirectory,"resume.docx");const download=await fetch(resume.url);if(!download.ok)throw new Error("Private resume download failed");writeFileSync(target,Buffer.from(await download.arrayBuffer()));const pkg=application.package??application.application_packages?.[0];if(pkg){pkg.answer_manifest={...(pkg.answer_manifest??{}),localResumePath:target};}}const item:QueueItem={applicationId,url:job.canonical_url,platform:detectPlatform(job.canonical_url),state:"queued",payload:response as unknown as Record<string,unknown>};queue.upsert(item);}
async function processItem(item:QueueItem,api:CompanionApi){const payload=item.payload as unknown as ApplicationResponse;const application=payload.application;const pkg=application.package??application.application_packages?.[0]??{};const manifest=pkg.answer_manifest??{};const result=await fillApplication({url:item.url,platform:item.platform as Platform,profile:manifest.profile??{},answers:manifest.answers??{},resumePath:manifest.localResumePath??"",profileDirectory:join(root,"chrome-profile")});const state=result.state==="review_ready"?"review_ready":"paused";queue.upsert({...item,state,...(result.reason?{pauseReason:result.reason}:{})});await api.event(item.applicationId,state==="review_ready"?"review_ready":"paused",{code:result.reason,fieldCount:result.fieldCount});process.stdout.write(state==="review_ready"?"Fields are ready for review. Final Submit was not clicked.\n":`Paused: ${result.reason}\n`);}
