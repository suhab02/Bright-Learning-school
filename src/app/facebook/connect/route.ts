import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { facebookAdmin, facebookConfig, saveSession } from "@/lib/facebook/server";
export async function GET() {
  const ctx=await facebookAdmin();const c=facebookConfig();
  if(!c)return NextResponse.redirect(new URL('/facebook?status=setup','https://bright-learning-school.vercel.app'));
  const nonce=randomBytes(24).toString('hex');
  await saveSession({userId:ctx.userId,schoolId:ctx.schoolId,token:nonce,purpose:"state",expires:Date.now()+600000});
  const url=new URL(`https://www.facebook.com/${c.version}/dialog/oauth`);
  url.searchParams.set('client_id',c.id);url.searchParams.set('redirect_uri',c.redirect);url.searchParams.set('state',nonce);url.searchParams.set('response_type','code');
  url.searchParams.set('scope','pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts,pages_manage_engagement,pages_messaging,pages_manage_metadata');
  return NextResponse.redirect(url);
}
