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
  const db=await supabaseServer();const {data,error}=await db.from('schools').update({facebook_page_url:url}).eq('id',ctx.schoolId).select('id');
  if(error)return {error:'save'};if(!data?.length)return {error:'permission'};
  revalidatePath('/facebook');revalidatePath('/dashboard');revalidatePath('/portal');return {ok:true};
}
