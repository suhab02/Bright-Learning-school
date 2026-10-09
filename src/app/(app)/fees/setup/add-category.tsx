"use client";
import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { addCategory, type FeeState } from "../actions";

export function AddCategory() {
  const { t } = useT();
  const f = t.fees;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<FeeState & { n?: number } | null, FormData>(
    async (prev, fd) => { const r = await addCategory(prev, fd); return r ? { ...r, n: (prev?.n ?? 0) + 1 } : r; }, null);
  if (!open) return <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}><Plus className="size-5" />{f.addCategory}</Button>;
  const typed = state && !state.ok ? state.values : undefined;
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-[17px] font-bold">{f.addCategory}</h3>
      <form key={state?.n ?? 0} action={action} className="flex flex-col gap-4">
        <Field label={f.nameBn} htmlFor="cat_bn"><Input id="cat_bn" name="name_bn" defaultValue={typed?.name_bn} required /></Field>
        <Field label={f.nameEn} htmlFor="cat_en"><Input id="cat_en" name="name_en" defaultValue={typed?.name_en} required /></Field>
        <Field label={f.frequencyLabel} htmlFor="cat_freq">
          <Select id="cat_freq" name="frequency" defaultValue={typed?.frequency ?? "one_time"}>
            {(["monthly", "one_time", "annual"] as const).map((x) => <option key={x} value={x}>{f.frequency[x]}</option>)}
          </Select>
        </Field>
        {state?.ok && <Notice tone="success">{f.categoryAdded}</Notice>}
        {state && !state.ok && <Notice tone="error">{state.error === "permission" ? t.common.permissionDenied : (f.errors as Record<string, string>)[state.error ?? "save"] ?? f.errors.save}</Notice>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
          <Button type="submit" disabled={pending}>{f.addShort}</Button>
        </div>
      </form>
    </Card>
  );
}
