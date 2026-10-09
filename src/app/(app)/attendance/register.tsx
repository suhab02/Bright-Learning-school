"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/client";
import { attendanceLabels } from "@/lib/attendance/labels";
import { STATUSES, type AttendanceRow, type AttendanceStatus } from "@/lib/attendance/shared";
import { Avatar } from "@/components/page";
import { Button, Card, Field, Input, Notice, Textarea } from "@/components/ui";
import { saveAttendance } from "./actions";

export function Register({ rows, section, date, editable, past }: {
  rows: AttendanceRow[]; section: string; date: string; editable: boolean; past: boolean;
}) {
  const locale = useLocale();
  const s = attendanceLabels(locale);
  const [draft, setDraft] = useState(rows);
  const [reason, setReason] = useState("");
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(saveAttendance, null);
  const previous = useRef(state);
  const values = dirty || pending ? draft : rows;
  useEffect(() => {
    if (state && state !== previous.current && state.ok) {
      setDirty(false);
      window.dispatchEvent(new Event("school:saved"));
    }
    previous.current = state;
  }, [state]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const guard = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("a[href]") && !window.confirm(s.dirty)) { event.preventDefault(); event.stopPropagation(); }
    };
    const guardSubmit = (event: SubmitEvent) => {
      if ((event.target as HTMLFormElement).method === "get" && !window.confirm(s.dirty)) event.preventDefault();
    };
    document.addEventListener("submit", guardSubmit, true);
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", guard, true); document.removeEventListener("submit", guardSubmit, true); };
  }, [dirty, s.dirty]);
  function patch(id: string, change: { status?: AttendanceStatus; note?: string }) {
    setDraft(values.map((row) => row.student_id === id ? { ...row, ...change } : row));
    setDirty(true);
  }
  const complete = values.every((row) => row.status !== null);
  return <form action={action} data-unsaved={dirty ? "true" : "false"} className="space-y-4">
    <input type="hidden" name="section" value={section} />
    <input type="hidden" name="date" value={date} />
    <input type="hidden" name="entries" value={JSON.stringify(values.map((r) => ({ student_id: r.student_id,
      status: r.status, note: r.note ?? "", expected_marked_at: r.marked_at })))} />
    <div className="grid grid-cols-2 gap-2" aria-live="polite">
      {STATUSES.map((status) => <Card key={status} className="p-3 text-sm"><span>{s.statuses[status]}</span>
        <strong className="float-right">{values.filter((r) => r.status === status).length}</strong></Card>)}
    </div>
    {editable && <Button variant="secondary" type="button" disabled={pending} className="w-full" onClick={() => {
      setDraft(values.map((r) => ({ ...r, status: "present" }))); setDirty(true);
    }}>{s.allPresent}</Button>}
    {!editable && <Notice>{past ? s.past : s.viewOnly}</Notice>}
    <fieldset disabled={!editable || pending} className="space-y-3">
      {values.map((row) => {
        const name = locale === "bn" ? row.full_name_bn || row.full_name_en : row.full_name_en;
        return <Card key={row.student_id} className="p-4">
          <div className="mb-3 flex items-center gap-3"><Avatar name={name} id={row.student_id} />
            <div className="min-w-0"><h2 className="break-words font-semibold">{name}</h2>
              <p className="text-sm text-ink-2">{s.roll} {row.roll_no ?? "—"} · {row.student_code}</p></div></div>
          <fieldset className="grid grid-cols-2 gap-2"><legend className="sr-only">{s.title}: {name}</legend>
            {STATUSES.map((status) => <label key={status} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm ${row.status === status ? "bg-brand text-white" : "bg-surface-2"}`}>
              <input type="radio" name={`status-${row.student_id}`} checked={row.status === status} value={status}
                onChange={() => patch(row.student_id, { status })} />{s.statuses[status]}</label>)}
          </fieldset>
          {!row.status && <p className="mt-2 text-sm text-ink-2">{s.unmarked}</p>}
          <Field label={s.note} htmlFor={`note-${row.student_id}`} className="mt-3">
            <Input id={`note-${row.student_id}`} value={row.note ?? ""} maxLength={300}
              onChange={(e) => patch(row.student_id, { note: e.target.value })} />
          </Field>
        </Card>;
      })}
    </fieldset>
    {editable && <>
      {past ? <Field label={s.reason} hint={s.reasonHint} htmlFor="reason"><Textarea id="reason" name="reason"
        required minLength={3} maxLength={300} value={reason} disabled={pending}
        onChange={(e) => { setReason(e.target.value); setDirty(true); }} /></Field> : <input type="hidden" name="reason" value="" />}
      {!complete && <Notice>{s.pending}</Notice>}
      {state?.error && <Notice tone="error">{s.errors[state.error]}</Notice>}
      {state?.ok && !dirty && <Notice tone="success">{s.saved}</Notice>}
      <Button type="submit" className="w-full" disabled={pending || !complete || (past && reason.trim().length < 3)}>
        {pending ? s.saving : s.save}</Button>
    </>}
  </form>;
}
