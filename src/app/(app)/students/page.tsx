import { Suspense } from "react";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { className, displayName, getSectionOptions, listStudents } from "@/lib/data/students";
import { formatNumber, toBnDigits } from "@/lib/format";
import { Card, Skeleton } from "@/components/ui";
import { Avatar, Chip, EmptyState, ListRow, PageHeader } from "@/components/page";
import { cn } from "@/lib/cn";
import { SearchBox } from "./search-box";
import { photoUrls } from "@/lib/data/photos";

export const metadata = { title: "Students" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

async function StudentList({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireContext();
  const [sp, { locale, t }, school] = await Promise.all([searchParams, getT(), getSchool(ctx.schoolId)]);
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const q = one(sp.q) ?? "";
  const classId = one(sp.class);
  const includeLeft = one(sp.left) === "1";
  const page = Number(one(sp.page) ?? 1) || 1;
  const [sections, list] = await Promise.all([
    getSectionOptions(ctx.schoolId),
    listStudents({ q, classId, includeLeft, page }),
  ]);
  const photos = await photoUrls(list.rows.map((r) => r.photo_path));
  const classes = [...new Map(sections.map((s) => [s.class_id, s])).values()];
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { q: q || undefined, class: classId, left: includeLeft ? "1" : undefined, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `/students?${s}` : "/students";
  };
  const canAdd = can(ctx, "students.create");
  const s = t.students;

  return (
    <div>
      <PageHeader title={s.title} subtitle={`${formatNumber(list.total, bn)} ${s.count}`}
        action={canAdd ? (
          <Link href="/students/new" aria-label={s.add}
            className="press grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-[0_10px_24px_-10px_var(--brand)]">
            <Plus className="size-6" strokeWidth={2.5} />
          </Link>
        ) : undefined} />

      <SearchBox placeholder={s.search} label={s.searchLabel} />

      {/* class filter chips */}
      <div className="-mx-3 mt-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {[{ id: undefined as string | undefined, label: s.allClasses }, ...classes.map((c) => ({ id: c.class_id, label: locale === "bn" ? c.class_name_bn : c.class_name_en }))].map((c) => {
          const active = c.id === classId;
          return (
            <Link key={c.id ?? "all"} href={href({ class: c.id, page: undefined })} scroll={false}
              className={cn("press shrink-0 rounded-full px-4 py-2 text-sm font-semibold",
                active ? "bg-brand text-white" : "bg-surface text-ink-2 card-shadow")}>
              {c.label}
            </Link>
          );
        })}
      </div>
      <Link href={href({ left: includeLeft ? undefined : "1", page: undefined })} scroll={false}
        className="mt-2 inline-flex items-center gap-2 px-1 text-sm text-ink-2">
        <span className={cn("grid size-5 place-items-center rounded-md border-2", includeLeft ? "border-brand bg-brand text-white" : "border-line")}>
          {includeLeft && "✓"}
        </span>
        {s.showLeft}
      </Link>

      <Card className="mt-4 overflow-hidden">
        {list.rows.length === 0 ? (
          <EmptyState icon={GraduationCap} title={q || classId ? s.noMatch : s.empty}
            action={!q && !classId && canAdd ? <Link href="/students/new" className="press inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-white"><Plus className="size-5" />{s.add}</Link> : undefined} />
        ) : (
          <ul className="divide-y divide-line/70">
            {list.rows.map((r) => {
              const name = displayName(r, locale);
              const cls = className(r, locale);
              const parts = [cls, r.roll_no ? `${s.roll} ${formatNumber(r.roll_no, bn)}` : null, bn.bnDigits ? toBnDigits(r.student_code) : r.student_code].filter(Boolean);
              return (
                <li key={r.id}>
                  <ListRow href={`/students/${r.id}`} leading={<Avatar name={name} id={r.id} src={r.photo_path ? photos[r.photo_path] : null} />}
                    title={name} subtitle={parts.join(" · ")}
                    trailing={r.status !== "active" ? <Chip tint="rose">{s.status[r.status as keyof typeof s.status] ?? r.status}</Chip> : undefined} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {list.pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Pages">
          {list.page > 1 ? <Link href={href({ page: String(list.page - 1) })} className="press rounded-2xl bg-surface px-4 py-3 font-semibold card-shadow">{s.prev}</Link> : <span />}
          <span className="num text-sm text-ink-2">{formatNumber(list.page, bn)} / {formatNumber(list.pages, bn)}</span>
          {list.page < list.pages ? <Link href={href({ page: String(list.page + 1) })} className="press rounded-2xl bg-surface px-4 py-3 font-semibold card-shadow">{s.next}</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/students">) {
  return (
    <Suspense fallback={<div className="space-y-3"><Skeleton className="h-12 w-48" /><Skeleton className="h-13" /><Skeleton className="h-96" /></div>}>
      <StudentList searchParams={searchParams} />
    </Suspense>
  );
}
