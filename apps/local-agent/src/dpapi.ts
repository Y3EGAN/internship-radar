import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const assembly = `[Reflection.Assembly]::LoadWithPartialName('System.Security')|Out-Null;`;
const protectScript = `${assembly}$v=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($v);$e=[System.Security.Cryptography.ProtectedData]::Protect($b,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($e))`;
const unprotectScript = `${assembly}$v=[Console]::In.ReadToEnd();$e=[Convert]::FromBase64String($v);$b=[System.Security.Cryptography.ProtectedData]::Unprotect($e,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($b))`;

function encoded(script:string){return Buffer.from(script,"utf16le").toString("base64");}
function powershellPath(){return join(process.env.SystemRoot??"C:\\Windows","System32","WindowsPowerShell","v1.0","powershell.exe");}

export class DpapiTokenStore {
  constructor(private readonly path:string){}
  save(token:string){if(process.platform!=="win32")throw new Error("DPAPI token storage requires Windows");const encrypted=execFileSync(powershellPath(),["-NoProfile","-NonInteractive","-EncodedCommand",encoded(protectScript)],{input:token,encoding:"utf8",windowsHide:true});mkdirSync(dirname(this.path),{recursive:true});writeFileSync(this.path,encrypted,{encoding:"utf8",mode:0o600});}
  load(){if(process.platform!=="win32")throw new Error("DPAPI token storage requires Windows");const encrypted=readFileSync(this.path,"utf8");return execFileSync(powershellPath(),["-NoProfile","-NonInteractive","-EncodedCommand",encoded(unprotectScript)],{input:encrypted,encoding:"utf8",windowsHide:true});}
}
