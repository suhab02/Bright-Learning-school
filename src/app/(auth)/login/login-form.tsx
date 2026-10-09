"use client";
import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";
import { safeNext } from "@/lib/safe-next";
import { GoogleButton } from "../google-button";

export function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = use(searchParams);
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const { t } = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(sp.error ? t.common.errorGeneric : null);
  const linkNotice = sp.notice === "link";
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: String(f.get("email")).trim(), password: String(f.get("password")),
    });
    if (error) {
      setBusy(false);
      setError(error.code === "email_not_confirmed" ? t.auth.emailNotConfirmed
        : error.code === "invalid_credentials" ? t.auth.invalidCredentials : t.common.errorGeneric);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <Card className="p-6 shadow-xl shadow-brand/10">
      <h2 className="text-xl font-semibold">{t.auth.signInTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{t.auth.signInSubtitle}</p>
      {linkNotice && <Notice tone="success" className="mt-4">{t.auth.linkOpened}</Notice>}
      <div className="mt-5"><GoogleButton next={next} /></div>
      <div className="my-5 flex items-center gap-3 text-xs text-ink-2">
        <span className="h-px flex-1 bg-line" />{t.auth.or}<span className="h-px flex-1 bg-line" />
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate={false}>
        <Field label={t.auth.email} htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required inputMode="email" />
        </Field>
        <Field label={t.auth.password} htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" size="lg" disabled={busy}>{busy ? t.auth.signingIn : t.auth.signIn}</Button>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-sm">
        <Link href="/reset-password" className="text-accent hover:underline">{t.auth.forgot}</Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent hover:underline">{t.auth.noAccount}</Link>
      </div>
    </Card>
  );
}
