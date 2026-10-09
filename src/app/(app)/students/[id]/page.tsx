import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Phone, Users, Wallet } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { className, displayName, getStudent } from "@/lib/data/students";
import { formatDate, formatNumber, toBnDigits } from "@/lib/format";
import { Card, Notice, Skeleton } from "@/components/ui";
import { Avatar, Chip, EmptyState, ListRow, PageHeader, SectionTitle } from "@/components/page";
import { StatusControl } from "./status-control";
import { ProfilePhoto } from "../photo-picker";
import { photoUrls } from "@/lib/data/photos";
import { AdminDelete } from "@/components/admin-delete";
import { GuardianMessage } from "@/components/guardian-message";

export const metadata = { title: "Student" };

async function Profile({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  const [{ id }, sp, { locale, t }, school] = await Promise.all([params, searchParams, getT(), getSchool(ctx.schoolId)]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const st = await getStudent(id);
  if (!st) notFound();
  const photos = await photoUrls([st.photo_path]);
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const digits = (v: string) => (bn.bnDigits ? toBnDigits(v) : v);
  const s = t.students;
  const name = displayName(st, locale);
  const other = locale === "bn" ? st.full_name_en : st.full_name_bn;
  const rows: [string, string | null][] = [
    [s.studentId, digits(st.student_code)],
    [s.admissionNo, st.admission_no ? digits(st.admission_no) : null],
    [s.admissionDate, formatDate(st.admission_date, locale, bn)],
    [s.dob, st.date_of_birth ? formatDate(st.date_of_birth, locale, bn) : null],
    [s.gender, st.gender ? s.genders[st.gender as keyof typeof s.genders] : null],
    [s.blood, st.blood_group],
    [s.address, st.address],
  ];

  return (
    <div>
      <PageHeader title={s.title} back="/students"
        action={can(ctx, "students.edit") ? (
          <Link href={`/students/${id}/edit`} className="press inline-flex h-11 items-center gap-2 rounded-2xl bg-surface px-4 font-semibold card-shadow">
            <Pencil className="size-4" />{s.edit}
          </Link>
        ) : undefined} />

      {sp.admitted && <Notice tone="success" className="mb-4">{s.admitted}</Notice>}
      {sp.saved && <Notice tone="success" className="mb-4">{s.saved}</Notice>}
      {st.status !== "active" && <Notice tone="warn" className="mb-4">{s.leftNotice}</Notice>}

      <Card className="rise flex flex-col items-center px-5 pb-6 pt-7 text-center">
        <ProfilePhoto studentId={st.id} schoolId={ctx.schoolId} name={name} canEdit={can(ctx, "students.edit")}
          src={st.photo_path ? photos[st.photo_path] ?? null : null} />
        <h2 className="mt-4 text-[22px] font-bold leading-tight">{name}</h2>
        {other && other !== name && <p className="text-ink-2">{other}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {st.class_name_en && <Chip tint="blue">{className(st, locale)}</Chip>}
          {st.roll_no && <Chip tint="orange">{s.roll} {formatNumber(st.roll_no, bn)}</Chip>}
          <Chip tint={st.status === "active" ? "green" : "rose"}>{s.status[st.status as keyof typeof s.status] ?? st.status}</Chip>
        </div>
      </Card>

      {(can(ctx, "fees.view") || can(ctx, "fees.collect")) && (
        <Link href={`/fees/student/${st.id}`} className="press mt-3 flex items-center gap-3 rounded-[22px] bg-surface p-4 card-shadow">
          <span className="grid size-11 place-items-center rounded-2xl tint-green"><Wallet className="size-5" /></span>
          <span className="flex-1 font-semibold">{t.nav.fees}</span>
          <span aria-hidden className="text-ink-2/50">›</span>
        </Link>
      )}

      <SectionTitle>{s.guardians}</SectionTitle>
      <Card className="overflow-hidden">
        {st.guardians.length === 0 ? <EmptyState icon={Users} title={s.noGuardian} /> : (
          <ul className="divide-y divide-line/70">
            {st.guardians.map((g) => (
              <li key={g.id}>
                <ListRow leading={<Avatar name={g.full_name} id={g.id} size={40} />} title={g.full_name}
                  subtitle={[s.relationships[g.relationship as keyof typeof s.relationships], g.phone && digits(g.phone)].filter(Boolean).join(" · ")}
                  trailing={g.phone ? (
                    <a href={`tel:${g.phone}`} aria-label={`${s.call} ${g.full_name}`}
                      className="press grid size-11 place-items-center rounded-2xl tint-green"><Phone className="size-5" /></a>
                  ) : undefined} />
                {(can(ctx,"guardians.manage") || ctx.role === "teacher") && <div className="px-4 pb-3"><GuardianMessage name={g.full_name} phone={g.phone ?? ""} /></div>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(st.emergency_contact_name || st.emergency_contact_phone) && (
        <>
          <SectionTitle>{s.emergencyTitle}</SectionTitle>
          <Card className="overflow-hidden">
            <ListRow title={st.emergency_contact_name ?? "—"} subtitle={st.emergency_contact_phone ? digits(st.emergency_contact_phone) : undefined}
              trailing={st.emergency_contact_phone ? (
                <a href={`tel:${st.emergency_contact_phone}`} aria-label={s.call} className="press grid size-11 place-items-center rounded-2xl tint-rose"><Phone className="size-5" /></a>
              ) : undefined} />
          </Card>
        </>
      )}

      <SectionTitle>{s.details}</SectionTitle>
      <Card className="px-4 py-1">
        <dl className="divide-y divide-line/70">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-4 py-3">
              <dt className="text-sm text-ink-2">{k}</dt>
              <dd className="num text-right font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {(ctx.role === "admin" || ctx.role === "super_admin") && <div className="mt-6"><AdminDelete table="students" id={st.id} name={name} />{can(ctx,"students.archive") && <StatusControl id={st.id} status={st.status} />}</div>}
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/students/[id]">) {
  return <Suspense fallback={<div className="space-y-4"><Skeleton className="h-12 w-40" /><Skeleton className="h-64" /><Skeleton className="h-40" /></div>}><Profile params={params} searchParams={searchParams} /></Suspense>;
}
