import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { requireContext, type AppContext } from "../auth";
import { openSession, sealSession, type FacebookSession } from "./security";

export const FB_COOKIE={state:"bls_fb_state",pending:"bls_fb_pending",page:"bls_fb_page"};
export function facebookConfig() {
  const id=process.env.FACEBOOK_APP_ID,secret=process.env.FACEBOOK_APP_SECRET,version=process.env.FACEBOOK_GRAPH_VERSION,redirect=process.env.FACEBOOK_REDIRECT_URI;
  if(!id||!/^\d+$/.test(id)||!secret||secret.length<16||!version||!/^v\d+\.\d+$/.test(version)||!redirect)return null;
  try {const u=new URL(redirect); if(u.protocol!=="https:"||u.pathname!=="/facebook/callback"||u.search||u.hash||u.username||u.password)return null;}catch{return null;}
  return {id,secret,version,redirect};
}
export async function facebookAdmin() {
  const ctx=await requireContext();
  if(ctx.role!=="admin"&&ctx.role!=="super_admin")throw new Error("facebook_admin_only");
  return ctx;
}
export async function session(ctx:AppContext,purpose:FacebookSession["purpose"]) {
  const config=facebookConfig();if(!config)return null;
  const value=(await cookies()).get(FB_COOKIE[purpose])?.value;
  return value?openSession(value,config.secret,ctx.userId,ctx.schoolId,purpose):null;
}
export async function saveSession(value:FacebookSession) {
  const config=facebookConfig();if(!config)throw new Error("facebook_setup_required");
  const sealed=sealSession(value,config.secret);if(sealed.length>3800)throw new Error("facebook_token_too_large");
  (await cookies()).set(FB_COOKIE[value.purpose],sealed,{httpOnly:true,secure:true,sameSite:"lax",path:"/facebook",maxAge:Math.max(1,Math.floor((value.expires-Date.now())/1000))});
}
export class FacebookError extends Error {constructor(public code:number){super("facebook_request_failed");}}
export async function graph<T>(path:string,token:string,params:Record<string,string>={},method:"GET"|"POST"="GET"):Promise<T> {
  const c=facebookConfig();if(!c)throw new Error("facebook_setup_required");
  if(!/^[A-Za-z0-9_./-]+$/.test(path)||path.includes(".."))throw new Error("invalid_facebook_path");
  const url=new URL(`https://graph.facebook.com/${c.version}/${path}`);
  url.searchParams.set("appsecret_proof",createHmac("sha256",c.secret).update(token).digest("hex"));
  if(method==="GET")for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
  const response=await fetch(url,{method,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${token}`},...(method==="POST"?{body:new URLSearchParams(params)}:{})});
  const data=await response.json();if(!response.ok||data.error)throw new FacebookError(Number(data.error?.code)||0);
  return data as T;
}
export type FacebookPage={id:string;name:string;access_token:string;tasks?:string[]};
export async function pages(token:string) {return (await graph<{data:FacebookPage[]}>("me/accounts",token,{fields:"id,name,access_token,tasks",limit:"100"})).data;}
export type Post={id:string;message?:string;created_time:string;permalink_url?:string};
export type Comment={id:string;message?:string;from?:{id:string;name:string};created_time:string};
export type Conversation={id:string;participants:{data:{id:string;name?:string}[]};updated_time:string};
export type Message={id:string;message?:string;from:{id:string;name?:string};created_time:string};
export async function conversations(s:FacebookSession) {return (await graph<{data:Conversation[]}>(`${s.pageId}/conversations`,s.token,{fields:"id,participants,updated_time",platform:"messenger",limit:"10"})).data;}
export function safeFacebookLink(link:string|undefined) {try{const u=new URL(link||"");return u.protocol==="https:"&&(u.hostname==="facebook.com"||u.hostname.endsWith(".facebook.com"))?u.toString():null;}catch{return null;}}
