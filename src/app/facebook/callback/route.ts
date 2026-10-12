import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { facebookAdmin,facebookConfig,session,saveSession,FB_COOKIE } from "@/lib/facebook/server";
export async function GET(request:NextRequest) {
  const ctx=await facebookAdmin(); const c=facebookConfig();
  const destination=new URL('/facebook',c?.redirect||'https://bright-learning-school.vercel.app');
  const stored=await session(ctx,'state');const state=request.nextUrl.searchParams.get('state')||'';
  (await cookies()).delete(FB_COOKIE.state);
  if(!c||!stored||!/^([a-f0-9]{48})$/.test(state)||state.length!==stored.token.length||!timingSafeEqual(Buffer.from(state),Buffer.from(stored.token))) {destination.searchParams.set('status','failed');return NextResponse.redirect(destination);}
  if(request.nextUrl.searchParams.has('error')){destination.searchParams.set('status','cancelled');return NextResponse.redirect(destination);}
  try {
    const code=request.nextUrl.searchParams.get('code');if(!code||code.length>2048)throw new Error('missing_code');
    // POST keeps codes, app secret and exchanged tokens out of URL query logs.
    const exchange=async(params:Record<string,string>)=>{
      const r=await fetch(`https://graph.facebook.com/${c.version}/oauth/access_token`,{method:'POST',body:new URLSearchParams(params),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
      const data=await r.json();if(!r.ok||typeof data.access_token!=='string')throw new Error('exchange_failed');return data as {access_token:string;expires_in?:number};
    };
    const short=await exchange({client_id:c.id,client_secret:c.secret,redirect_uri:c.redirect,code});
    const long=await exchange({client_id:c.id,client_secret:c.secret,grant_type:'fb_exchange_token',fb_exchange_token:short.access_token});
    await saveSession({userId:ctx.userId,schoolId:ctx.schoolId,token:long.access_token,purpose:'pending',expires:Date.now()+600000});
    destination.searchParams.set('status','choose');
  }catch{destination.searchParams.set('status','failed');}
  return NextResponse.redirect(destination);
}
