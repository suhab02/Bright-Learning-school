"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { facebookPageUrl } from "@/lib/facebook/page-url";
export type FacebookPageState={ok?:boolean;error?:"permission"|"url"|"save"};
export async function saveFacebookPage(_previous:FacebookPageState,form:FormData):Promise<FacebookPageState> {
  let ctx;try{ctx=await requirePermission('settings.manage');}catch{return {error:'permission'};}
  const raw=String(form.get('pageUrl')||'').trim();const url=raw?facebookPageUrl(raw):null;
  if(raw&&!url)return {error:'url'};
  const postRaw=String(form.get('postUrl')||'').trim(),text=String(form.get('postText')||'').trim(),date=String(form.get('postDate')||'').trim();
  let preview=null;
  if(url&&(postRaw||text||date)) {
    try {const p=new URL(postRaw);p.search='';p.hash='';if(p.origin!=='https://www.facebook.com'||!p.toString().startsWith(url+'/posts/')||!/^\/[^/]+\/posts\/[A-Za-z0-9]+$/.test(p.pathname)||!text||text.length>2000||!date||date.length>40)return {error:'url'};preview={url:p.toString(),text,date,savedAt:new Date().toISOString()};}catch{return {error:'url'};}
  }
  const db=await supabaseServer();const {data,error}=await db.from('schools').update({facebook_page_url:url,facebook_post_preview:preview}).eq('id',ctx.schoolId).select('id');
  if(error)return {error:'save'};if(!data?.length)return {error:'permission'};
  revalidatePath('/facebook');revalidatePath('/dashboard');revalidatePath('/portal');return {ok:true};
}
