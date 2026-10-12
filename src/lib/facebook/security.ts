import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type FacebookSession = { userId:string; schoolId:string; token:string; pageId?:string; name?:string; expires:number; purpose:"state"|"pending"|"page" };
export function sealSession(value:FacebookSession, secret:string) {
  const iv=randomBytes(12); const cipher=createCipheriv("aes-256-gcm",createHash("sha256").update(secret).digest(),iv);
  const bytes=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString("base64url");
}
export function openSession(value:string, secret:string, userId:string, schoolId:string, purpose:FacebookSession["purpose"]):FacebookSession|null {
  try {
    const bytes=Buffer.from(value,"base64url"); if(bytes.length<29||bytes.length>3500)return null;
    const decipher=createDecipheriv("aes-256-gcm",createHash("sha256").update(secret).digest(),bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));
    const s=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString()) as FacebookSession;
    return s.userId===userId&&s.schoolId===schoolId&&s.purpose===purpose&&s.expires>Date.now()&&typeof s.token==="string"?s:null;
  } catch {return null;}
}
export function pagePostId(id:string,pageId:string) {return /^\d+_\d+$/.test(id)&&id.startsWith(pageId+"_");}
