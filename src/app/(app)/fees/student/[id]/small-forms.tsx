"use client";
import { useActionState, useState, useTransition } from "react";
import { BadgePercent, Plus, Sparkles } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import type { FeeCategory } from "@/lib/data/fees";
import { addCharge, applyAdvance, applyDiscount, type FeeState } from "../../actions";

function errText(t: ReturnType<typeof useT>["t"], state: FeeState) {
  if (!state || state.ok) return null;
  if (state.error === "permission") return t.common.permissionDenied;
  return (t.fees.errors as Record<string, string>)[state.error ?? "save"] ?? t.fees.errors.save;
}

export function AddChargeForm({ studentId, categories, today }: { studentId: string; categories: FeeCategory[]; today: string }) {
  const { t, locale } = useT();
  const f = t.fees;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FeeState & { n?: number } | null, FormData>(
    async (prev, fd) => { const r = await addCharge(studentId, prev, fd); return r ? { ...r, n: (prev?.n ?? 0) + 1 } : r; }, null);
  const typed = state && !state.ok ? state.values : undefined;
  if (!open) return <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}><Plus className="size-5" />{f.addCharge}</Button>;
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-[17px] font-bold">{f.addCharge}</h3>
      <form key={state?.n ?? 0} action={action} className="flex flex-col gap-4">
        <Field label={f.chargeType} htmlFor="category">
          <Select id="category" name="category" defaultValue={typed?.category ?? categories.find((c) => c.frequency !== "monthly")?.id}>
            {categories.map((c) => <option key={c.id} value={c.id}>{locale === "bn" ? c.name_bn : c.name_en}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={f.amount} htmlFor="charge_amount"><Input id="charge_amount" name="amount" inputMode="decimal" defaultValue={typed?.amount} required /></Field>
          <Field label={f.dueDate} htmlFor="due_on"><Input id="due_on" name="due_on" type="date" defaultValue={typed?.due_on ?? today} required /></Field>
        </div>
        <Field label={`${f.description} (${t.common.optional})`} htmlFor="description"><Input id="description" name="description" defaultValue={typed?.description} /></Field>
        {state?.ok && <Notice tone="success">{f.chargeAdded}</Notice>}
        {errText(t, state) && <Notice tone="error">{errText(t, state)}</Notice>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          <Button type="submit" disabled={pending}>{f.addChargeButton}</Button>
        </div>
      </form>
    </Card>
  );
}

export function DiscountForm({ itemId }: { itemId: string }) {
  const { t } = useT();
  const f = t.fees;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FeeState, FormData>(applyDiscount.bind(null, itemId), null);
  if (state?.ok) return <p role="status" className="text-[13px] font-semibold text-paid">{f.discountApplied}</p>;
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
      <BadgePercent className="size-4" />{f.discountTitle}
    </button>
  );
  return (
    <form action={action} className="mt-3 flex flex-col gap-3 rounded-2xl bg-surface-2 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Select name="kind" aria-label={f.discountTitle} defaultValue="discount">
          {(["discount", "waiver", "scholarship"] as const).map((k) => <option key={k} value={k}>{f.kinds[k]}</option>)}
        </Select>
        <Input name="amount" inputMode="decimal" placeholder="৳" aria-label={f.amount} required />
      </div>
      <Input name="reason" placeholder={f.reason} aria-label={f.reason} required />
      {errText(t, state) && <Notice tone="error">{errText(t, state)}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
        <Button type="submit" size="sm" disabled={pending}>{f.applyDiscount}</Button>
      </div>
    </form>
  );
}

export function UseAdvanceButton({ studentId }: { studentId: string }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button type="button" variant="light" size="sm" disabled={pending}
        onClick={() => start(async () => { const r = await applyAdvance(studentId); setMsg(r?.ok ? t.fees.advanceUsed : t.fees.errors.save); })}>
        <Sparkles className="size-4" />{t.fees.useAdvance}
      </Button>
      {msg && <p className="mt-2 text-sm text-white/85" role="status">{msg}</p>}
    </div>
  );
}
