"use client";
import { useActionState, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { Button, Card, Field, Input, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/cn";
import { collectPayment, type FeeState } from "../../actions";

export type OpenCharge = { id: string; label: string; outstanding: number; overdue: boolean };
const METHODS = ["cash", "bkash", "nagad", "rocket", "bank", "other"] as const;

type Props = { studentId: string; idempotencyKey: string; charges: OpenCharge[]; bnDigits: boolean };

/** React clears a form after each submit. After an error we rebuild the whole form (key)
 *  from what was submitted, so the chosen method, amount and reference are never lost. */
export function CollectForm(props: Props) {
  const [state, action, pending] = useActionState<FeeState & { n?: number } | null, FormData>(
    async (prev, fd) => { const r = await collectPayment(props.studentId, prev, fd); return r ? { ...r, n: (prev?.n ?? 0) + 1 } : r; }, null);
  return <CollectFields key={state?.n ?? 0} {...props} state={state} action={action} pending={pending} />;
}

function CollectFields({ idempotencyKey, charges, bnDigits, state, action, pending }: Props & {
  state: FeeState; action: (fd: FormData) => void; pending: boolean;
}) {
  const { t } = useT();
  const f = t.fees;
  const typed = state && !state.ok ? state.values : undefined;
  const [picked, setPicked] = useState<Set<string>>(() => new Set(charges.map((c) => c.id)));
  const pickedTotal = useMemo(() => charges.filter((c) => picked.has(c.id)).reduce((s, c) => s + c.outstanding, 0), [charges, picked]);
  const [amount, setAmount] = useState<string>(typed?.amount ?? (pickedTotal ? String(pickedTotal / 100) : ""));
  const [method, setMethod] = useState<string>(typed?.method ?? "cash");
  const money = (p: number) => formatTaka(p, { bnDigits });

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
    const total = charges.filter((c) => next.has(c.id)).reduce((s, c) => s + c.outstanding, 0);
    setAmount(total ? String(total / 100) : "");
  };
  const err = state && !state.ok ? (state.error === "permission" ? t.common.permissionDenied : (f.errors as Record<string, string>)[state.error ?? "save"] ?? f.errors.save) : null;
  const amountNum = Number(amount.replace(/,/g, ""));

  return (
    <Card className="p-5">
      <h2 className="text-[17px] font-bold">{f.collect}</h2>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="idempotency_key" value={idempotencyKey} />
        {charges.length > 0 && (
          <fieldset>
            <legend className="mb-2 px-1 text-[13px] font-semibold text-ink-2">{f.choose}</legend>
            <div className="flex flex-col gap-2">
              {charges.map((c) => {
                const on = picked.has(c.id);
                return (
                  <label key={c.id} className={cn("press flex cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-3",
                    on ? "bg-sky ring-2 ring-accent/40" : "bg-surface-2")}>
                    <input type="checkbox" name="item" value={c.id} checked={on} onChange={() => toggle(c.id)} className="sr-only" />
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-lg border-2", on ? "border-accent bg-accent text-white" : "border-line bg-surface")}>
                      {on && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.label}</span>
                      {c.overdue && <span className="text-xs font-semibold text-danger">{f.overdue}</span>}
                    </span>
                    <span className="num font-semibold">{money(c.outstanding)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <Field label={f.amount} htmlFor="amount" hint={f.payHint}>
          <span className="relative block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-ink-2">৳</span>
            <Input id="amount" name="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="h-16 pl-10 text-2xl font-bold num" placeholder="0" required aria-invalid={state?.error === "amount"} />
          </span>
        </Field>

        <fieldset>
          <legend className="mb-2 px-1 text-[13px] font-semibold text-ink-2">{f.method}</legend>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <label key={m} className={cn("press flex h-12 cursor-pointer items-center justify-center rounded-2xl text-[15px] font-semibold",
                method === m ? "bg-brand text-white" : "bg-surface-2 text-ink")}>
                <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                {f.methods[m]}
              </label>
            ))}
          </div>
        </fieldset>

        {method !== "cash" && (
          <Field label={f.reference} htmlFor="reference" hint={f.referenceHint}>
            <Input id="reference" name="reference" defaultValue={typed?.reference} autoComplete="off" autoCapitalize="characters"
              aria-invalid={state?.error === "reference"} />
          </Field>
        )}
        <Field label={`${f.note} (${t.common.optional})`} htmlFor="note">
          <Input id="note" name="note" defaultValue={typed?.note} />
        </Field>

        {err && <Notice tone="error">{err}</Notice>}
        <Button type="submit" variant="paid" size="lg" disabled={pending || !(amountNum > 0)}>
          {pending ? f.paying : `${f.pay}${amountNum > 0 ? ` · ${money(Math.round(amountNum * 100))}` : ""}`}
        </Button>
      </form>
    </Card>
  );
}
