"use client";
import { useActionState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button, Card, Input, Notice } from "@/components/ui";
import { IconChip } from "@/components/page";
import { useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/format";
import { billMonth, type FeeState } from "./actions";

export function BillMonth({ thisMonth, bnDigits }: { thisMonth: string; bnDigits: boolean }) {
  const { t } = useT();
  const f = t.fees;
  const [state, action, pending] = useActionState<FeeState, FormData>(billMonth, null);
  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <IconChip icon={CalendarPlus} tint="violet" size={40} />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">{f.bill}</h2>
          <p className="mt-0.5 text-[13px] text-ink-2">{f.billHint}</p>
        </div>
      </div>
      <form action={action} className="mt-4 flex flex-col gap-2">
        <Input name="month" type="month" defaultValue={thisMonth} aria-label={f.month} required />
        <Button type="submit" disabled={pending}>{f.billButton}</Button>
      </form>
      <div aria-live="polite">
        {state?.ok && (state.count ?? 0) > 0 && <Notice tone="success" className="mt-3">{formatNumber(state.count!, { bnDigits })} {f.billed}</Notice>}
        {state?.ok && state.count === 0 && <Notice tone="info" className="mt-3">{f.billedNone}</Notice>}
        {state && !state.ok && <Notice tone="error" className="mt-3">{state.error === "permission" ? t.common.permissionDenied : (f.errors as Record<string, string>)[state.error ?? "save"] ?? f.errors.save}</Notice>}
      </div>
    </Card>
  );
}
