"use client";
import { useState } from "react";
import { WorkflowForm } from "./workflow-form";
import { Field, Input } from "./ui";

export type MarkRow = {
  student_id: string;
  full_name_en: string;
  full_name_bn: string | null;
  roll_no: number | null;
  section_name: string;
  marks_obtained: number | null;
  is_absent: boolean;
  updated_at: string | null;
};
export function MarksRegister({
  rows,
  examSubject,
  fullMarks,
  locale,
}: {
  rows: MarkRow[];
  examSubject: string;
  fullMarks: number;
  locale: "bn" | "en";
}) {
  const [draft, setDraft] = useState(
    rows.map((r) => ({
      student_id: r.student_id,
      marks_obtained: r.marks_obtained === null ? "" : String(r.marks_obtained),
      is_absent: r.is_absent,
      expected_updated_at: r.updated_at,
    })),
  );
  const set = (index: number, change: Partial<(typeof draft)[number]>) =>
    setDraft((old) =>
      old.map((r, i) => (i === index ? { ...r, ...change } : r)),
    );
  return (
    <WorkflowForm
      operation="marks"
      locale={locale}
      fields={[]}
      hidden={{
        exam_subject_id: examSubject,
        entries: JSON.stringify(
          draft.map((r) => ({
            ...r,
            marks_obtained:
              r.is_absent || r.marks_obtained === ""
                ? null
                : Number(r.marks_obtained),
          })),
        ),
      }}
    >
      {rows.map((r, i) => (
        <div key={r.student_id} className="rounded-2xl bg-surface-2 p-3">
          <p className="font-semibold">
            {locale === "bn"
              ? r.full_name_bn || r.full_name_en
              : r.full_name_en}
          </p>
          <p className="mb-2 text-sm text-ink-2">
            {r.section_name} · {locale === "bn" ? "রোল" : "Roll"}{" "}
            {r.roll_no ?? "—"}
          </p>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft[i].is_absent}
              onChange={(e) => set(i, { is_absent: e.target.checked })}
            />
            {locale === "bn" ? "অনুপস্থিত" : "Absent"}
          </label>
          <Field
            label={`${locale === "bn" ? "নম্বর" : "Marks"} / ${fullMarks}`}
            htmlFor={`marks-${r.student_id}`}
          >
            <Input
              id={`marks-${r.student_id}`}
              type="number"
              min="0"
              max={fullMarks}
              step="0.01"
              required={!draft[i].is_absent}
              disabled={draft[i].is_absent}
              value={draft[i].marks_obtained}
              onChange={(e) => set(i, { marks_obtained: e.target.value })}
            />
          </Field>
        </div>
      ))}
    </WorkflowForm>
  );
}
