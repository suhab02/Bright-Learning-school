"use client";
import { useActionState, useState } from "react";
import { DoorOpen, RotateCcw } from "lucide-react";
import { Button, Field, Input, Notice } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { setStudentStatus, type StudentFormState } from "../actions";

export function StatusControl({ id, status }: { id: string; status: string }) {
  const { t } = useT();
  const s = t.students;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<StudentFormState, FormData>(setStudentStatus.bind(null, id), null);
  const reasonErr = state?.fieldErrors?.reason ? s.errors.reason_required : undefined;

  if (status !== "active") {
    return (
      <form action={action}>
        <input type="hidden" name="status" value="active" />
        <Button type="submit" variant="secondary" className="w-full" disabled={pending}><RotateCcw className="size-4" />{s.markActive}</Button>
      </form>
    );
  }
  if (!open) {
    return <Button type="button" variant="ghost" className="w-full text-danger" onClick={() => setOpen(true)}><DoorOpen className="size-5" />{s.markLeft}</Button>;
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4 card-shadow">
      <input type="hidden" name="status" value="withdrawn" />
      <Field label={s.reason} htmlFor="reason" hint={s.reasonHint} error={reasonErr}>
        <Input id="reason" name="reason" autoFocus aria-invalid={!!reasonErr} />
      </Field>
      {state && !state.ok && state.error === "permission" && <Notice tone="error">{t.common.permissionDenied}</Notice>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>{t.common.cancel}</Button>
        <Button type="submit" variant="danger" disabled={pending}>{s.confirmLeft}</Button>
      </div>
    </form>
  );
}
