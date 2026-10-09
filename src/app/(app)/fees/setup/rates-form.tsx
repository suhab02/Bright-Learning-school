"use client";
import { useActionState, useRef } from "react";
import { Copy } from "lucide-react";
import { Button, Card, Input, Notice } from "@/components/ui";
import { Chip } from "@/components/page";
import { useT } from "@/lib/i18n/client";
import type { ClassOption, FeeCategory } from "@/lib/data/fees";
import { saveRates, type FeeState } from "../actions";

const toTaka = (p?: number) => (p ? String(p / 100) : "");

export function RatesForm({ category, classes, rates }: { category: FeeCategory; classes: ClassOption[]; rates: Record<string, number> }) {
  const { t, locale } = useT();
  const f = t.fees;
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<FeeState & { n?: number } | null, FormData>(
    async (prev, fd) => { const r = await saveRates(category.id, prev, fd); return r ? { ...r, n: (prev?.n ?? 0) + 1 } : r; }, null);
  const typed = state && !state.ok ? state.values : undefined;

  const fillAll = () => {
    const inputs = [...(form.current?.querySelectorAll<HTMLInputElement>("input[data-amount]") ?? [])];
    const first = inputs.find((i) => i.value.trim());
    if (first) inputs.forEach((i) => { i.value = first.value; });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[17px] font-bold">{locale === "bn" ? category.name_bn : category.name_en}</h3>
        <Chip tint={category.frequency === "monthly" ? "violet" : category.frequency === "annual" ? "teal" : "slate"}>{f.frequency[category.frequency]}</Chip>
      </div>
      <form key={state?.n ?? 0} ref={form} action={action} className="mt-4 flex flex-col gap-2.5">
        {classes.map((c) => (
          <label key={c.id} className="flex items-center gap-3">
            <span className="flex-1 text-[15px]">{locale === "bn" ? c.name_bn : c.name_en}</span>
            <span className="relative w-36">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-2">৳</span>
              <Input data-amount name={`amount_${c.id}`} inputMode="decimal" className="h-12 pl-8 text-right num"
                defaultValue={typed?.[`amount_${c.id}`] ?? toTaka(rates[c.id])} placeholder="0" />
            </span>
          </label>
        ))}
        <button type="button" onClick={fillAll} className="mt-1 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-accent">
          <Copy className="size-4" />{f.sameForAll}
        </button>
        <div aria-live="polite">
          {state?.ok && <Notice tone="success">{f.ratesSaved}</Notice>}
          {state && !state.ok && <Notice tone="error">{state.error === "permission" ? t.common.permissionDenied : (f.errors as Record<string, string>)[state.error ?? "save"] ?? f.errors.save}</Notice>}
        </div>
        <Button type="submit" disabled={pending} className="mt-1">{f.saveRates}</Button>
      </form>
    </Card>
  );
}
