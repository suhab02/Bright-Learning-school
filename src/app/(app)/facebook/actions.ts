"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { facebookAdmin,session,saveSession,pages,graph,conversations,FB_COOKIE,FacebookError,type Message } from "@/lib/facebook/server";
import { pagePostId } from "@/lib/facebook/security";
export type FacebookActionState={ok?:string;error?:string};
export async function facebookAction(_previous:FacebookActionState,form:FormData):Promise<FacebookActionState> {
  try {
    const ctx=await facebookAdmin(); const op=z.enum(['select','disconnect','publish','comment','message']).parse(form.get('op'));
    if(op==='disconnect'){const store=await cookies();store.delete(FB_COOKIE.page);store.delete(FB_COOKIE.pending);store.delete(FB_COOKIE.state);revalidatePath('/facebook');return {ok:'disconnected'};}
    if(op==='select'){
      const pending=await session(ctx,'pending');if(!pending)throw new Error('reconnect');
      const id=z.string().regex(/^\d+$/).parse(form.get('pageId'));const page=(await pages(pending.token)).find(p=>p.id===id);
      if(!page?.access_token)throw new Error('reconnect');
      await saveSession({userId:ctx.userId,schoolId:ctx.schoolId,token:page.access_token,pageId:page.id,name:page.name,purpose:'page',expires:Date.now()+7*86400000});
      (await cookies()).delete(FB_COOKIE.pending);revalidatePath('/facebook');return {ok:'connected'};
    }
    const s=await session(ctx,'page');if(!s?.pageId)throw new Error('reconnect');
    if(form.get('confirm')!=='yes')throw new Error('confirmation');
    const text=z.string().trim().min(1).max(op==='message'?2000:5000).parse(form.get('text'));
    if(op==='publish')await graph(`${s.pageId}/feed`,s.token,{message:text},'POST');
    if(op==='comment'){
      const postId=z.string().parse(form.get('postId'));if(!pagePostId(postId,s.pageId))throw new Error('invalid_target');
      const commentId=z.string().regex(/^\d+_\d+$/).parse(form.get('target'));
      const parent=await graph<{parent?:{id:string}}>(commentId,s.token,{fields:'parent'});
      if(parent.parent?.id!==postId)throw new Error('invalid_target');
      await graph(`${commentId}/comments`,s.token,{message:text},'POST');
    }
    if(op==='message'){
      const id=z.string().max(120).regex(/^[A-Za-z0-9_-]+$/).parse(form.get('target'));
      const conversation=(await conversations(s)).find(c=>c.id===id);if(!conversation)throw new Error('invalid_target');
      const person=conversation.participants.data.find(p=>p.id!==s.pageId);if(!person)throw new Error('invalid_target');
      const messages=(await graph<{data:Message[]}>(`${id}/messages`,s.token,{fields:'id,from,message,created_time',limit:'50'})).data;
      const inbound=messages.filter(m=>m.from?.id===person.id).map(m=>Date.parse(m.created_time)).filter(Number.isFinite);
      const last=Math.max(0,...inbound);if(Date.now()-last>86400000)throw new Error('window');
      await graph(`${s.pageId}/messages`,s.token,{recipient:JSON.stringify({id:person.id}),messaging_type:'RESPONSE',message:JSON.stringify({text})},'POST');
    }
    revalidatePath('/facebook');return {ok:'sent'};
  }catch(error){
    if(error instanceof FacebookError)return {error:error.code===190?'reconnect':[10,200].includes(error.code)?'permissions':'request'};
    const code=error instanceof Error?error.message:'';
    return {error:['facebook_admin_only','reconnect','confirmation','window','invalid_target'].includes(code)?code:'request'};
  }
}
