"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { safeNext } from "@/lib/safe-next";

type Outcome = "working" | "expired" | "failed";

/**
 * Landing page for links in sign-up and password-reset emails. Works on any device:
 *  - #access_token=…&refresh_token=… (implicit email links) → stored as the normal session
 *  - ?code=… (same-browser PKCE links)                      → handed to /auth/callback
 *  - #error=…                                                → explained, with a way forward
 */
export function CompleteSignIn() {
  const { t } = useT();
  const router = useRouter();
  const [outcome, setOutcome] = useState<Outcome>("working");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const type = hash.get("type");
    const next = safeNext(url.searchParams.get("next"), type === "recovery" ? "/auth/update-password" : "/");
    // Remove tokens from the address bar and browser history straight away.
    history.replaceState(null, "", url.pathname);

    const code = url.searchParams.get("code");
    if (code) {
      window.location.replace(`/auth/callback?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
      return;
    }
    const errCode = hash.get("error_code") ?? hash.get("error");
    if (errCode) {
      setOutcome(/expired|otp/i.test(errCode) ? "expired" : "failed"); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }
    const access_token = hash.get("access_token");
    const refresh_token = hash.get("refresh_token");
    if (!access_token || !refresh_token) { setOutcome("failed"); return; }

    (async () => {
      const { error }: { error: unknown } = await supabaseBrowser().auth.setSession({ access_token, refresh_token });
      if (error) { setOutcome("failed"); return; }
      router.replace(type === "recovery" ? "/auth/update-password" : next);
      router.refresh();
    })();
  }, [router]);

  return (
    <Card className="p-6">
      {outcome === "working" ? (
        <p role="status" className="text-ink-2">{t.auth.completing}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Notice tone="error">{outcome === "expired" ? t.auth.linkExpired : t.auth.linkFailed}</Notice>
          <Link href="/reset-password"><Button className="w-full">{t.auth.requestNewLink}</Button></Link>
          <Link href="/login" className="text-sm text-accent hover:underline">{t.auth.signIn}</Link>
        </div>
      )}
    </Card>
  );
}
