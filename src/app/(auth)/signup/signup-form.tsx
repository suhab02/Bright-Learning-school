"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { supabaseEmailLinks } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { safeNext } from "@/lib/safe-next";
import { GoogleButton } from "../google-button";

export function SignupForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = use(searchParams);
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const { t } = useT();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState("busy");
    const { error } = await supabaseEmailLinks().auth.signUp({
      email: String(f.get("email")).trim(),
      password: String(f.get("password")),
      options: {
        data: { full_name: String(f.get("full_name")).trim() },
        emailRedirectTo: `${location.origin}/auth/complete?next=${encodeURIComponent(next)}`,
      },
    });
    setState(error ? "error" : "sent");
  }

  // Signing up never grants access by itself: the account must match an invitation.
  return (
    <Card className="rise p-6">
      <h2 className="text-[22px] font-bold">{t.auth.signUpTitle}</h2>
      {state === "sent" ? (
        <Notice tone="success" className="mt-4">{t.auth.checkEmail}</Notice>
      ) : (
        <>
          <div className="mt-5"><GoogleButton next={next} /></div>
          <div className="my-5 flex items-center gap-3 text-xs text-ink-2">
            <span className="h-px flex-1 bg-line" />{t.auth.or}<span className="h-px flex-1 bg-line" />
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <Field label={t.auth.fullName} htmlFor="full_name"><Input id="full_name" name="full_name" required autoComplete="name" /></Field>
            <Field label={t.auth.email} htmlFor="email"><Input id="email" name="email" type="email" required autoComplete="email" /></Field>
            <Field label={t.auth.password} htmlFor="password" hint={t.auth.passwordRule}>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </Field>
            {state === "error" && <Notice tone="error">{t.common.errorGeneric}</Notice>}
            <Button type="submit" size="lg" disabled={state === "busy"}>{t.auth.signUp}</Button>
          </form>
        </>
      )}
      <Link href="/login" className="mt-5 block text-sm text-accent hover:underline">{t.auth.haveAccount}</Link>
    </Card>
  );
}
