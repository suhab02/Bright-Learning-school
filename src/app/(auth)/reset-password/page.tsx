"use client";
import { useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { supabaseEmailLinks } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

export default function ResetPasswordPage() {
  const { t } = useT();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Card className="p-6 shadow-xl shadow-brand/10">
      <h2 className="text-xl font-semibold">{t.auth.resetTitle}</h2>
      {sent ? <Notice tone="success" className="mt-4">{t.auth.resetSent}</Notice> : (
        <form className="mt-5 flex flex-col gap-4" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          const email = String(new FormData(e.currentTarget).get("email")).trim();
          await supabaseEmailLinks().auth.resetPasswordForEmail(email, {
            redirectTo: `${location.origin}/auth/complete?next=/auth/update-password`,
          });
          setSent(true); // same message whether or not the account exists
        }}>
          <Field label={t.auth.email} htmlFor="email"><Input id="email" name="email" type="email" required /></Field>
          <Button type="submit" size="lg" disabled={busy}>{t.auth.resetSend}</Button>
        </form>
      )}
      <Link href="/login" className="mt-5 block text-sm text-accent hover:underline">{t.auth.haveAccount}</Link>
    </Card>
  );
}
