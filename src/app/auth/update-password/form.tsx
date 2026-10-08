"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/lib/i18n/client";

export function UpdatePasswordForm() {
  const { t } = useT();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">{t.auth.setPassword}</h1>
      <form className="mt-5 flex flex-col gap-4" onSubmit={async (e) => {
        e.preventDefault(); setState("busy");
        const password = String(new FormData(e.currentTarget).get("password"));
        const { error } = await supabaseBrowser().auth.updateUser({ password });
        if (error) return setState("error");
        setState("done"); setTimeout(() => { router.replace("/"); router.refresh(); }, 1200);
      }}>
        <Field label={t.auth.newPassword} htmlFor="password" hint={t.auth.passwordRule}>
          <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
        </Field>
        {state === "error" && <Notice tone="error">{t.common.errorGeneric}</Notice>}
        {state === "done" && <Notice tone="success">{t.auth.passwordUpdated}</Notice>}
        <Button type="submit" size="lg" disabled={state === "busy" || state === "done"}>{t.auth.setPassword}</Button>
      </form>
    </Card>
  );
}
