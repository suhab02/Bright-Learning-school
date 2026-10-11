import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool, schoolName, schoolPlace } from "@/lib/data/school";
import { className, displayName, getStudent } from "@/lib/data/students";
import { photoUrls } from "@/lib/data/photos";
import { schoolRows, str } from "@/lib/workflows/data";
import { formatNumber, toBnDigits } from "@/lib/format";
import { PageHeader } from "@/components/page";
import { Skeleton } from "@/components/ui";
import { StudentIdCard } from "./student-id-card";

export const metadata = { title: "Student ID card" };

async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const [{ id }, { locale, t }, school, years] = await Promise.all([
    params, getT(), getSchool(ctx.schoolId), schoolRows("academic_years", ctx.schoolId),
  ]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const student = await getStudent(id);
  if (!student) notFound();
  const photos = await photoUrls([student.photo_path]);
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const year = years.find((row) => row.is_current);
  return <div className="student-id-page">
    <div className="no-print"><PageHeader title={locale === "bn" ? "শিক্ষার্থী আইডি কার্ড" : "Student ID card"} back={`/students/${id}`} /></div>
    <StudentIdCard locale={locale} data={{
      name: displayName(student, locale),
      school: schoolName(school, locale), logo: school.logoUrl,
      code: bn.bnDigits ? toBnDigits(student.student_code) : student.student_code,
      classLabel: className(student, locale) || "—",
      roll: student.roll_no !== null ? formatNumber(student.roll_no, bn) : "—",
      photo: student.photo_path ? photos[student.photo_path] ?? null : null,
      year: year ? str(year, "name") : "",
      status: t.students.status[student.status as keyof typeof t.students.status] ?? student.status,
      active: student.status === "active", phone: school.phone,
      address: school.address_line || schoolPlace(school),
    }} />
  </div>;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Skeleton className="h-96" />}><CardPage params={params} /></Suspense>;
}
