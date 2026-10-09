import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSectionOptions } from "@/lib/data/students";
import { attendanceRoster, schoolToday } from "@/lib/data/attendance";
import { attendanceLabels } from "@/lib/attendance/labels";
import { validDate } from "@/lib/attendance/shared";
import { PageHeader, EmptyState } from "@/components/page";
import { Button, Card, Field, Input, Notice, Select, Skeleton } from "@/components/ui";
import { Register } from "./register";

export const metadata = { title: "Attendance" };
async function Attendance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  if (ctx.role === "guardian") redirect("/portal/attendance");
  if (!can(ctx, "attendance.view") && !can(ctx, "attendance.create") && !ctx.teachesSections.length) redirect("/no-access");
  const [{ locale }, allSections, today, sp] = await Promise.all([getT(), getSectionOptions(ctx.schoolId), schoolToday(ctx.schoolId), searchParams]);
  const s = attendanceLabels(locale);
  const sections = can(ctx, "attendance.view") || can(ctx, "attendance.create") ? allSections
    : allSections.filter((section) => ctx.teachesSections.includes(section.id));
  const requested = typeof sp.section === "string" ? sp.section : "";
  const section = requested ? sections.find((section) => section.id === requested) : sections[0];
  const date = typeof sp.date === "string" ? sp.date : today;
  const valid = validDate(date) && date <= today;
  const rows = section && valid ? await attendanceRoster(section.id, date) : [];
  const writable = !!section && (can(ctx, "attendance.create") || ctx.teachesSections.includes(section.id));
  const editable = writable && (date === today || can(ctx, "attendance.correct"));
  return <div>
    <PageHeader title={s.title} />
    <Card className="mb-4 p-4"><form method="get" className="space-y-3">
      <Field label={s.section} htmlFor="section"><Select id="section" name="section" defaultValue={section?.id ?? ""} required>
        {!section && <option value="">{s.section}</option>}
        {sections.map((sec) => <option key={sec.id} value={sec.id}>{locale === "bn" ? sec.class_name_bn : sec.class_name_en} ({sec.name})</option>)}
      </Select></Field>
      <Field label={s.date} htmlFor="date"><Input id="date" type="date" name="date" max={today} defaultValue={valid ? date : today} required /></Field>
      <Button type="submit" className="w-full" disabled={!sections.length}>{s.open}</Button>
    </form></Card>
    {(!valid || (requested && !section)) && <Notice tone="error">{s.errors.invalid}</Notice>}
    <p className="mb-3 px-1 text-sm text-ink-2">{s.currentRoster}</p>
    {!sections.length ? <EmptyState icon={CalendarCheck} title={s.noSections} />
      : section && valid ? rows.length ? <Register key={`${section.id}:${date}`} rows={rows} section={section.id}
        date={date} editable={editable} past={date < today} /> : <EmptyState icon={CalendarCheck} title={s.empty} /> : null}
  </div>;
}
export default function Page({ searchParams }: PageProps<"/attendance">) {
  return <Suspense fallback={<Skeleton className="h-96" />}><Attendance searchParams={searchParams} /></Suspense>;
}
