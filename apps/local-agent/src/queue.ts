import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type QueueItem={applicationId:string;url:string;platform:string;state:"queued"|"paused"|"review_ready";pauseReason?:string;payload:Record<string,unknown>};
export class LocalQueue{
  constructor(readonly path:string){}
  list():QueueItem[]{if(!existsSync(this.path))return[];return JSON.parse(readFileSync(this.path,"utf8")) as QueueItem[];}
  upsert(item:QueueItem){const items=this.list().filter(current=>current.applicationId!==item.applicationId);items.push(item);mkdirSync(dirname(this.path),{recursive:true});const temporary=`${this.path}.tmp`;writeFileSync(temporary,JSON.stringify(items,null,2),"utf8");renameSync(temporary,this.path);}
}
