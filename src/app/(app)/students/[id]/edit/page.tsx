import { Suspense } from "react";
import { notFound } from "next/navigation";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSectionOptions, getStudent } from "@/lib/data/students";
import { dhakaToday } from "@/lib/format";
import { Notice, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
import { StudentForm } from "../../student-form";
import { updateStudent } from "../../actions";

export const metadata = { title: "Edit student" };

async function EditStudent({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ t }, sections, st] = await Promise.all([getT(), getSectionOptions(ctx.schoolId), getStudent(id)]);
  if (!st) notFound();
  if (!can(ctx, "students.edit")) return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  return (
    <div>
      <PageHeader title={t.students.edit} subtitle={st.full_name_bn || st.full_name_en} back={`/students/${id}`} />
      <StudentForm action={updateStudent.bind(null, id)} sections={sections} mode="edit" today={dhakaToday()} editGuardian={can(ctx, "guardians.manage")}
        initial={{
          full_name_bn: st.full_name_bn ?? "", full_name_en: st.full_name_en, date_of_birth: st.date_of_birth ?? "",
          gender: st.gender ?? "", blood_group: st.blood_group ?? "", admission_date: st.admission_date,
          admission_no: st.admission_no ?? "", section_id: st.section_id ?? "", roll_no: st.roll_no ? String(st.roll_no) : "",
          address: st.address ?? "", emergency_contact_name: st.emergency_contact_name ?? "",
          emergency_contact_phone: st.emergency_contact_phone ?? "",
          guardian_name: st.guardians[0]?.full_name ?? "",
          guardian_phone: st.guardians[0]?.phone ?? "",
          guardian_email: st.guardians[0]?.email ?? "",
          guardian_relationship: st.guardians[0]?.relationship ?? "father",
        }} />
    </div>
  );
}

export default function Page({ params }: PageProps<"/students/[id]/edit">) {
  return <Suspense fallback={<Skeleton className="h-96" />}><EditStudent params={params} /></Suspense>;
}
