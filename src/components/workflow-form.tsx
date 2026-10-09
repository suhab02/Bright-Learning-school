"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { saveWorkflow, type WorkflowState } from "@/lib/workflows/actions";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";

export type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  min?: string;
  max?: string;
  step?: string;
};
const CREATES = new Set([
  "class",
  "section",
  "subject",
  "staff",
  "assignment",
  "homework",
  "notice",
  "exam",
  "exam_subject",
  "expense",
  "expense_category",
  "period",
  "timetable",
  "calendar",
  "grade_scale",
  "grade_band",
]);

export function WorkflowForm({
  operation,
  fields,
  hidden = {},
  submit,
  locale,
  children,
}: {
  operation: string;
  fields: FormField[];
  hidden?: Record<string, string>;
  submit?: string;
  locale: "bn" | "en";
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState<WorkflowState, FormData>(
    saveWorkflow,
    {},
  );
  const prefix = useId();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success && ref.current) {
      ref.current.dataset.unsaved = "false";
      if (CREATES.has(operation)) ref.current.reset();
      window.dispatchEvent(new Event("school:saved"));
    }
  }, [state, operation]);
  return (
    <form ref={ref} action={action} className="space-y-3">
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={`${prefix}-${f.name}`}>
          {f.options ? (
            <Select
              id={`${prefix}-${f.name}`}
              name={f.name}
              defaultValue={f.value ?? ""}
              required={f.required}
              disabled={pending}
            >
              {!f.value && (
                <option value="">
                  {locale === "bn" ? "নির্বাচন করুন" : "Choose"}
                </option>
              )}
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          ) : f.type === "textarea" ? (
            <Textarea
              id={`${prefix}-${f.name}`}
              name={f.name}
              defaultValue={f.value}
              required={f.required}
              maxLength={10000}
              disabled={pending}
            />
          ) : (
            <Input
              id={`${prefix}-${f.name}`}
              name={f.name}
              type={f.type ?? "text"}
              defaultValue={f.value}
              required={f.required}
              min={f.min}
              max={f.max}
              step={f.step}
              maxLength={1000}
              disabled={pending}
            />
          )}
        </Field>
      ))}
      {children && <fieldset disabled={pending}>{children}</fieldset>}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.success && (
        <Notice tone="success">
          {locale === "bn" ? "সংরক্ষিত হয়েছে" : "Saved"}
        </Notice>
      )}
      {state.invitePath && (
        <Notice>
          <p>
            {locale === "bn"
              ? "এই লিংকটি কপি করে আমন্ত্রিত ব্যক্তিকে দিন। ৭ দিন মেয়াদ।"
              : "Copy this link and share it with the invited person. Valid for 7 days."}
          </p>
          <a className="mt-2 block break-all underline" href={state.invitePath}>
            {typeof window === "undefined"
              ? state.invitePath
              : `${window.location.origin}${state.invitePath}`}
          </a>
        </Notice>
      )}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending
          ? locale === "bn"
            ? "সংরক্ষণ হচ্ছে…"
            : "Saving…"
          : (submit ?? (locale === "bn" ? "সংরক্ষণ করুন" : "Save"))}
      </Button>
    </form>
  );
}
