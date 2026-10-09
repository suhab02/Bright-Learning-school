"use client";
import { useActionState, useState } from "react";
import { Printer, Undo2 } from "lucide-react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { reversePayment, type FeeState } from "../../fees/actions";

export function PrintButton() {
  const { t } = useT();
  return <Button type="button" size="lg" className="w-full" onClick={() => window.print()}><Printer className="size-5" />{t.fees.print}</Button>;
}

export function ReverseForm({ paymentId }: { paymentId: string }) {
  const { t } = useT();
  const f = t.fees;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FeeState, FormData>(reversePayment.bind(null, paymentId), null);
  if (!open) return <Button type="button" variant="ghost" className="w-full text-danger" onClick={() => setOpen(true)}><Undo2 className="size-5" />{f.reverse}</Button>;
  const err = state && !state.ok ? (state.error === "permission" ? t.common.permissionDenied : (f.errors as Record<string, string>)[state.error ?? "save"] ?? f.errors.save) : null;
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 card-shadow">
      <Notice tone="warn">{f.reverseHint}</Notice>
      <Field label={f.reason} htmlFor="reverse_reason"><Input id="reverse_reason" name="reason" autoFocus required minLength={5} /></Field>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
        <Button type="submit" variant="danger" disabled={pending}>{f.confirmReverse}</Button>
      </div>
    </form>
  );
}
