import { Suspense } from "react";
import { CalendarCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { schoolToday } from "@/lib/data/attendance";
import { attendanceLabels } from "@/lib/attendance/labels";
import { monthRange, STATUSES, type AttendanceStatus } from "@/lib/attendance/shared";
import { displayName, type DirectoryRow } from "@/lib/data/students";
import { Card, Field, Input, Button, Notice, Skeleton } from "@/components/ui";
import { Chip, EmptyState, PageHeader } from "@/components/page";

async function ParentAttendance({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  if (ctx.role !== "guardian") redirect("/attendance");
  const [{ locale }, today, sp, supabase] = await Promise.all([getT(), schoolToday(ctx.schoolId), searchParams, supabaseServer()]);
  const s = attendanceLabels(locale);
  const month = typeof sp.month === "string" ? sp.month : today.slice(0, 7);
  const range = monthRange(month);
  const { data: children, error: childError } = await supabase.from("student_directory").select("*").eq("school_id", ctx.schoolId).order("full_name_en");
  if (childError) throw childError;
  const { data: entries, error } = range ? await supabase.from("student_attendance")
    .select("student_id,date,status,note").eq("school_id", ctx.schoolId).gte("date", range.start).lte("date", range.end).order("date", { ascending: false }).limit(10000)
    : { data: [], error: null };
  if (error) throw error;
  type Entry = { student_id: string; date: string; status: AttendanceStatus; note: string | null };
  return <div><PageHeader title={s.title} />
    <Card className="mb-4 p-4"><form method="get" className="space-y-3"><Field label={s.month} htmlFor="month">
      <Input type="month" name="month" id="month" defaultValue={range ? month : today.slice(0, 7)} required />
    </Field><Button type="submit" className="w-full">{s.view}</Button></form></Card>
    {!range && <Notice tone="error">{s.errors.invalid}</Notice>}
    {!children?.length && <EmptyState icon={CalendarCheck} title={s.noChildren} />}
    {range && (children as DirectoryRow[] ?? []).map((child) => {
      const records = ((entries ?? []) as Entry[]).filter((entry) => entry.student_id === child.id);
      const attended = records.filter((entry) => entry.status === "present" || entry.status === "late").length;
      return <Card key={child.id} className="mb-4 p-4"><h2 className="text-xl font-bold">{displayName(child, locale)}</h2>
        <p className="mt-2 text-sm text-ink-2">{s.recorded}: {records.length}</p>
        <p className="text-sm text-ink-2">{s.percentage}: {records.length ? `${Math.round(attended / records.length * 100)}%` : "—"}</p>
        <div className="my-3 grid grid-cols-2 gap-2">{STATUSES.map((status) => <span key={status} className="rounded-xl bg-surface-2 p-2 text-sm">
          {s.statuses[status]}: {records.filter((entry) => entry.status === status).length}</span>)}</div>
        {!records.length ? <p className="text-sm text-ink-2">{s.noRecords}</p> : <ul className="divide-y divide-line">
          {records.map((record) => <li key={record.date} className="py-3"><div className="flex justify-between gap-2">
            <time dateTime={record.date}>{new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${record.date}T00:00:00Z`))}</time>
            <Chip tint={record.status === "absent" ? "rose" : "blue"}>{s.statuses[record.status]}</Chip></div>
            {record.note && <p className="mt-1 break-words text-sm text-ink-2">{record.note}</p>}</li>)}
        </ul>}
      </Card>;
    })}
  </div>;
}
export default function Page({ searchParams }: PageProps<"/portal/attendance">) {
  return <Suspense fallback={<Skeleton className="h-96" />}><ParentAttendance searchParams={searchParams} /></Suspense>;
}
