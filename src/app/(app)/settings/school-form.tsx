"use client";
import { useActionState, useEffect, useState } from "react";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { useT } from "@/lib/i18n/client";
import { formatTaka } from "@/lib/format";
import type { SchoolRow } from "@/lib/data/school";
import { updateSchool, type FormState } from "./actions";

export function SchoolForm({ school, readOnly }: { school: SchoolRow; readOnly: boolean }) {
  const { t } = useT();
  const [state, action, pending] = useActionState<FormState, FormData>(updateSchool, null);
  // "edited while showing result X": unsaved if edited after the latest result, or the last save failed
  const [editedAt, setEditedAt] = useState<FormState | "clean">("clean");
  const dirty = editedAt !== "clean" && (editedAt === state || !state?.ok);
  const [color, setColor] = useState(school.primary_color);

  // don't silently lose edits when navigating away
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    addEventListener("beforeunload", h);
    return () => removeEventListener("beforeunload", h);
  }, [dirty]);

  const err = (k: string) => {
    const c = state?.fieldErrors?.[k];
    if (!c) return undefined;
    return c === "phone" ? t.common.invalidPhone : c === "email" ? t.common.invalidEmail
      : c === "url" ? t.common.invalidUrl : c === "range" ? t.common.invalidRange
      : c.toLowerCase().includes("small") ? t.common.tooShort : t.common.invalidField;
  };
  const s = t.settings;
  const text = (name: keyof SchoolRow, label: string, o: { type?: string; inputMode?: "numeric" | "tel" | "email" | "url" | "decimal"; required?: boolean; hint?: string } = {}) => (
    <Field label={label} htmlFor={name} error={err(name)} hint={o.hint}>
      <Input id={name} name={name} type={o.type ?? "text"} inputMode={o.inputMode} required={o.required}
        defaultValue={(school[name] as string | number | null) ?? ""} disabled={readOnly} aria-invalid={Boolean(err(name))} />
    </Field>
  );

  return (
    <form action={action} onChange={() => setEditedAt(state)} className="space-y-5">
      <fieldset disabled={readOnly || pending} className="space-y-5">
        <Card className="p-5">
          <h2 className="font-semibold">{s.identity}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {text("name_bn", s.nameBn, { required: true })}
            {text("name_en", s.nameEn, { required: true })}
            {text("slogan_bn", s.sloganBn)}
            {text("slogan_en", s.sloganEn)}
            {text("head_teacher_name", s.headTeacher)}
            {text("established_year", s.established, { inputMode: "numeric" })}
            {text("registration_no", s.registration)}
            <Field label={s.description} htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" name="description" defaultValue={school.description ?? ""} />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">{s.location}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">{text("address_line", s.address)}</div>
            {text("village_area", s.village)}
            {text("union_name", s.union)}
            {text("upazila", s.upazila)}
            {text("district", s.district)}
            {text("division", s.division)}
            {text("postal_code", s.postalCode, { inputMode: "numeric" })}
            <div className="sm:col-span-2 lg:col-span-3">{text("maps_url", s.mapsUrl, { type: "url", inputMode: "url" })}</div>
            {text("latitude", s.latitude, { inputMode: "decimal" })}
            {text("longitude", s.longitude, { inputMode: "decimal" })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">{s.contact}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {text("phone", s.phone, { type: "tel", inputMode: "tel" })}
            {text("whatsapp", s.whatsapp, { type: "tel", inputMode: "tel" })}
            {text("email", s.email, { type: "email", inputMode: "email" })}
            {text("website", s.website, { type: "url", inputMode: "url" })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">{s.branding}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label={s.primaryColor} htmlFor="primary_color" error={err("primary_color")}>
              <div className="flex items-center gap-3">
                <input id="primary_color" name="primary_color" type="color" value={color}
                  onChange={(e) => setColor(e.target.value)} className="h-11 w-16 cursor-pointer rounded-xl border border-line bg-surface p-1" />
                <span className="num text-sm text-ink-2">{color.toUpperCase()}</span>
                <span className="ml-auto rounded-lg px-3 py-1.5 text-sm text-white" style={{ background: color }}>{school.name_bn}</span>
              </div>
            </Field>
            <Field label={s.defaultLanguage} htmlFor="default_locale">
              <Select id="default_locale" name="default_locale" defaultValue={school.default_locale}>
                <option value="bn">বাংলা</option><option value="en">English</option>
              </Select>
            </Field>
            <label className="flex items-center gap-3 sm:col-span-2">
              <input type="checkbox" name="use_bengali_digits" defaultChecked={school.use_bengali_digits} className="size-5 accent-[var(--brand)]" />
              {s.bengaliDigits}
            </label>
            {text("receipt_header", s.receiptHeader)}
            {text("report_header", s.reportHeader)}
            {text("receipt_prefix", s.receiptPrefix, { required: true, hint: s.receiptPrefixHint })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">{s.academic}</h2>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium">{s.workingDays}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {t.days.map((d, i) => (
                <label key={i} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 has-checked:border-accent has-checked:bg-sky">
                  <input type="checkbox" name="working_days" value={i} defaultChecked={school.working_days.includes(i)} className="accent-[var(--brand)]" />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 grid max-w-md grid-cols-2 gap-4">
            <Field label={s.schoolHours} htmlFor="school_starts">
              <Input id="school_starts" name="school_starts" type="time" defaultValue={school.school_starts?.slice(0, 5) ?? "08:00"} />
            </Field>
            <Field label={"\u00a0"} htmlFor="school_ends" error={err("school_ends")}>
              <Input id="school_ends" name="school_ends" type="time" defaultValue={school.school_ends?.slice(0, 5) ?? "13:00"} />
            </Field>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">{s.feesSettings}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field label={s.dueDay} htmlFor="default_due_day" error={err("default_due_day")}>
              <Input id="default_due_day" name="default_due_day" type="number" min={1} max={28} defaultValue={school.default_due_day} />
            </Field>
            <Field label={s.lateFee} htmlFor="late_fee_amount" error={err("late_fee_amount")}>
              <Input id="late_fee_amount" name="late_fee_amount" inputMode="decimal"
                defaultValue={formatTaka(school.late_fee_amount).replace("৳", "")} />
            </Field>
            <Field label={s.graceDays} htmlFor="late_fee_grace_days">
              <Input id="late_fee_grace_days" name="late_fee_grace_days" type="number" min={0} max={60} defaultValue={school.late_fee_grace_days} />
            </Field>
            <label className="flex items-center gap-3 sm:col-span-3">
              <input type="checkbox" name="late_fee_enabled" defaultChecked={school.late_fee_enabled} className="size-5 accent-[var(--brand)]" />
              {s.lateFeeEnabled}
            </label>
          </div>
        </Card>
      </fieldset>

      {!readOnly && (
        <div className="sticky bottom-20 lg:bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-3 backdrop-blur">
          <Button type="submit" size="lg" disabled={pending}>{pending ? t.common.saving : t.common.save}</Button>
          <div aria-live="polite" className="text-sm">
            {state?.ok && !dirty && <span className="text-paid">{t.common.saved}</span>}
            {state && !state.ok && state.error === "permission" && <span className="text-danger">{t.common.permissionDenied}</span>}
            {state && !state.ok && state.error === "save" && <span className="text-danger">{t.common.errorGeneric}</span>}
            {state?.fieldErrors && <span className="text-danger">{t.common.invalidField}</span>}
            {dirty && !pending && <span className="text-ink-2">{t.common.unsaved}</span>}
          </div>
        </div>
      )}
      {readOnly && <Notice>{s.readOnly}</Notice>}
    </form>
  );
}
