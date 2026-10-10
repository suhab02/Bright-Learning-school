"use client";
import { useActionState, useState } from "react";
import { BookOpen, HeartPulse, UserRound, Users } from "lucide-react";
import { Button, Card, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { IconChip, type Tint } from "@/components/page";
import { useT } from "@/lib/i18n/client";
import type { SectionOption } from "@/lib/data/students";
import type { StudentFormState } from "./actions";
import { AdmissionPhoto } from "./photo-picker";

export type StudentInitial = Partial<Record<
  "full_name_bn" | "full_name_en" | "date_of_birth" | "gender" | "blood_group" | "admission_date" | "admission_no" |
  "section_id" | "roll_no" | "address" | "guardian_name" | "guardian_relationship" | "guardian_phone" | "guardian_email" |
  "emergency_contact_name" | "emergency_contact_phone", string>>;

function Group({ icon, tint, title, children }: { icon: typeof UserRound; tint: Tint; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <IconChip icon={icon} tint={tint} size={36} />
        <h2 className="text-[17px] font-bold">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </Card>
  );
}

export function StudentForm({ action, sections, initial = {}, requestId, mode, today, schoolId, editGuardian = false }: {
  action: (s: StudentFormState, fd: FormData) => Promise<StudentFormState>;
  sections: SectionOption[]; initial?: StudentInitial; requestId?: string; mode: "new" | "edit"; today: string; schoolId?: string; editGuardian?: boolean;
}) {
  const { t, locale } = useT();
  const s = t.students;
  // React resets a form after its action runs; remount it with what was typed so nothing is lost on an error
  const [state, formAction, pending] = useActionState<StudentFormState & { n?: number } | null, FormData>(
    async (prev, fd) => { const r = await action(prev, fd); return r ? { ...r, n: (prev?.n ?? 0) + 1 } : r; }, null);
  const [dirty, setDirty] = useState(false);
  const err = (k: string) => {
    const code = state?.fieldErrors?.[k];
    if (!code) return undefined;
    return (s.errors as Record<string, string>)[code] ?? t.common.invalidField;
  };
  const v = (k: keyof StudentInitial) => state?.values?.[k] ?? initial[k] ?? "";

  return (
    <form key={state?.n ?? 0} action={formAction} onChange={() => setDirty(true)} className="flex flex-col gap-4 pb-4" noValidate>
      {requestId && <input type="hidden" name="request_id" value={requestId} />}

      <Group icon={UserRound} tint="orange" title={s.studentDetails}>
        {mode === "new" && schoolId && <AdmissionPhoto schoolId={schoolId} initialPath={state?.values?.photo_path} />}
        <Field label={s.nameBn} htmlFor="full_name_bn" error={err("full_name_bn")} hint={s.nameHint}>
          <Input id="full_name_bn" name="full_name_bn" defaultValue={v("full_name_bn")} lang="bn" autoComplete="off" aria-invalid={!!err("full_name_bn")} />
        </Field>
        <Field label={s.nameEn} htmlFor="full_name_en">
          <Input id="full_name_en" name="full_name_en" defaultValue={v("full_name_en")} autoComplete="off" autoCapitalize="words" />
        </Field>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Field label={s.dob} htmlFor="date_of_birth">
            <Input id="date_of_birth" name="date_of_birth" type="date" max={today} defaultValue={v("date_of_birth")} />
          </Field>
          <Field label={s.gender} htmlFor="gender">
            <Select id="gender" name="gender" defaultValue={v("gender")}>
              <option value="">—</option>
              {(["male", "female", "other"] as const).map((g) => <option key={g} value={g}>{s.genders[g]}</option>)}
            </Select>
          </Field>
          <Field label={s.blood} htmlFor="blood_group">
            <Select id="blood_group" name="blood_group" defaultValue={v("blood_group")}>
              <option value="">—</option>
              {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label={s.admissionDate} htmlFor="admission_date">
            <Input id="admission_date" name="admission_date" type="date" defaultValue={v("admission_date") || today} />
          </Field>
        </div>
        <Field label={s.address} htmlFor="address">
          <Textarea id="address" name="address" rows={2} defaultValue={v("address")} />
        </Field>
      </Group>

      <Group icon={BookOpen} tint="blue" title={s.classSection}>
        <Field label={s.klass} htmlFor="section_id" error={err("section_id")}>
          <Select id="section_id" name="section_id" defaultValue={v("section_id")} required aria-invalid={!!err("section_id")}>
            <option value="" disabled>{s.chooseClass}</option>
            {sections.map((x) => (
              <option key={x.id} value={x.id}>{locale === "bn" ? x.class_name_bn : x.class_name_en} — {x.name}</option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <Field label={s.roll} htmlFor="roll_no" error={err("roll_no")}>
            <Input id="roll_no" name="roll_no" inputMode="numeric" defaultValue={v("roll_no")} aria-invalid={!!err("roll_no")} />
          </Field>
          <Field label={s.admissionNo} htmlFor="admission_no" error={err("admission_no")}>
            <Input id="admission_no" name="admission_no" defaultValue={v("admission_no")} aria-invalid={!!err("admission_no")} />
          </Field>
        </div>
        <p className="-mt-2 px-1 text-xs text-ink-2">{s.rollHint}</p>
      </Group>

      {(mode === "new" || editGuardian) && (
        <Group icon={Users} tint="violet" title={s.guardianTitle}>
          {mode === "edit" && <p className="text-sm text-ink-2">{locale === "bn" ? "প্রধান অভিভাবকের তথ্য যোগ বা সম্পাদনা করুন। একই অভিভাবকের অন্য সন্তান থাকলে যোগাযোগের তথ্য তাদের ক্ষেত্রেও পরিবর্তন হবে। সব ঘর খালি করলে অভিভাবক মুছে যাবে না।" : "Add or edit the primary guardian. Contact changes also apply to their other linked children. Leaving all fields blank does not remove the guardian."}</p>}
          <Field label={s.guardianName} htmlFor="guardian_name">
            <Input id="guardian_name" name="guardian_name" defaultValue={v("guardian_name")} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <Field label={s.relationship} htmlFor="guardian_relationship">
              <Select id="guardian_relationship" name="guardian_relationship" defaultValue={v("guardian_relationship") || "father"}>
                {(["father", "mother", "legal_guardian", "other"] as const).map((r) => <option key={r} value={r}>{s.relationships[r]}</option>)}
              </Select>
            </Field>
            <Field label={s.guardianPhone} htmlFor="guardian_phone" error={err("guardian_phone")}>
              <Input id="guardian_phone" name="guardian_phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX"
                defaultValue={v("guardian_phone")} aria-invalid={!!err("guardian_phone")} />
            </Field>
          </div>
          <p className="-mt-2 px-1 text-xs text-ink-2">{s.guardianHint}</p>
          <Field label={`${s.guardianEmail} (${t.common.optional})`} htmlFor="guardian_email" error={err("guardian_email")}>
            <Input id="guardian_email" name="guardian_email" type="email" inputMode="email" defaultValue={v("guardian_email")} />
          </Field>
        </Group>
      )}

      <Group icon={HeartPulse} tint="rose" title={s.emergencyTitle}>
        <Field label={s.emergencyName} htmlFor="emergency_contact_name">
          <Input id="emergency_contact_name" name="emergency_contact_name" defaultValue={v("emergency_contact_name")} />
        </Field>
        <Field label={s.emergencyPhone} htmlFor="emergency_contact_phone" error={err("emergency_contact_phone")}>
          <Input id="emergency_contact_phone" name="emergency_contact_phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX"
            defaultValue={v("emergency_contact_phone")} aria-invalid={!!err("emergency_contact_phone")} />
        </Field>
      </Group>

      <div aria-live="polite">
        {state && !state.ok && state.error === "permission" && <Notice tone="error">{t.common.permissionDenied}</Notice>}
        {state && !state.ok && state.error === "save" && <Notice tone="error">{t.common.errorGeneric}</Notice>}
        {state && !state.ok && state.error && (s.errors as Record<string, string>)[state.error] && !state.fieldErrors &&
          <Notice tone="error">{(s.errors as Record<string, string>)[state.error]}</Notice>}
        {state?.fieldErrors && <Notice tone="error">{t.common.invalidField}</Notice>}
      </div>

      <div className="sticky bottom-[calc(96px+env(safe-area-inset-bottom))] z-20 rounded-2xl bg-bg/95 p-2 backdrop-blur-sm lg:bottom-4">
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? s.saving : mode === "new" ? s.save : s.saveEdit}
        </Button>
        {dirty && !pending && <p className="sr-only">{t.common.unsaved}</p>}
      </div>
    </form>
  );
}
