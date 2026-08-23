export class CompanionApi{
  constructor(private readonly baseUrl:string,private readonly token:string){}
  private async request(path:string,init?:RequestInit){const response=await fetch(new URL(path,this.baseUrl),{...init,headers:{authorization:`Bearer ${this.token}`,"content-type":"application/json",...init?.headers}});if(response.status===204)return null;if(!response.ok)throw new Error(`Companion API request failed (${response.status})`);return response.json();}
  next(){return this.request("/api/companion/applications/next");}
  get(id:string){return this.request(`/api/companion/applications/${encodeURIComponent(id)}`);}
  event(id:string,eventType:"progress"|"paused"|"review_ready",detail:Record<string,unknown>){return this.request(`/api/companion/applications/${encodeURIComponent(id)}/events`,{method:"POST",body:JSON.stringify({eventType,detail})});}
  static async pair(baseUrl:string,pairingCode:string){const response=await fetch(new URL("/api/devices/pair",baseUrl),{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation:"consume",pairingCode})});if(!response.ok)throw new Error("Pairing code was invalid or expired");return response.json() as Promise<{token:string}>;}
}
