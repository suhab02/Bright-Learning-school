import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

/** OAuth (Google) and email-link sign-ins land here with a one-time code. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // Usually an email link opened on another device/browser: the email IS confirmed,
  // but the one-time login can't complete there. Ask the person to sign in normally.
  return NextResponse.redirect(new URL("/login?notice=link", url.origin));
}
