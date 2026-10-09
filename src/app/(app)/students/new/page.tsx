import { Suspense } from "react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSectionOptions } from "@/lib/data/students";
import { dhakaToday } from "@/lib/format";
import { Notice, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
import { StudentForm } from "../student-form";
import { admitStudent } from "../actions";

export const metadata = { title: "Admit student" };

async function NewStudent() {
  const ctx = await requireContext();
  const [{ t }, sections] = await Promise.all([getT(), getSectionOptions(ctx.schoolId)]);
  if (!can(ctx, "students.create")) return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  // one id per opened form: a double tap or retry can never admit the same child twice
  const requestId = crypto.randomUUID();
  return (
    <div>
      <PageHeader title={t.students.add} back="/students" />
      <StudentForm action={admitStudent} sections={sections} requestId={requestId} mode="new" today={dhakaToday()} />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="space-y-4"><Skeleton className="h-12 w-56" /><Skeleton className="h-96" /></div>}><NewStudent /></Suspense>;
}
