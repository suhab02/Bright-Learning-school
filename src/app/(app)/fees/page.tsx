import { Suspense } from "react";
import { AlertCircle, Receipt, Settings2, Wallet, Wallet2 } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { getDueStudents } from "@/lib/data/fees";
import { className, displayName, listStudents } from "@/lib/data/students";
import { supabaseServer } from "@/lib/supabase/server";
import { dhakaToday, formatNumber, formatTaka } from "@/lib/format";
import { Card, Notice, Skeleton } from "@/components/ui";
import { Avatar, Chip, EmptyState, IconChip, ListRow, PageHeader, SectionTitle, Tile } from "@/components/page";
import { SearchBox } from "../students/search-box";
import { BillMonth } from "./bill-month";
import { photoUrls } from "@/lib/data/photos";

export const metadata = { title: "Fees" };

async function Fees({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  const [sp, { locale, t }, school] = await Promise.all([searchParams, getT(), getSchool(ctx.schoolId)]);
  const f = t.fees;
  if (!(can(ctx, "fees.view") || can(ctx, "fees.collect"))) return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const money = (v: number) => formatTaka(v, bn);
  const q = typeof sp.q === "string" ? sp.q : "";
  const today = dhakaToday();

  const supabase = await supabaseServer();
  const [summary, dues, found] = await Promise.all([
    can(ctx, "reports.view")
      ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: today.slice(0, 8) + "01", p_to: today }).then((r) => r.data as Record<string, number> | null)
      : null,
    q ? null : getDueStudents(),
    q ? listStudents({ q }) : null,
  ]);

  const photos = await photoUrls([...(dues ?? []).map((d) => d.student.photo_path), ...(found?.rows ?? []).map((r) => r.photo_path)]);
  return (
    <div>
      <PageHeader title={f.title} />

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 rounded-[22px] brand-band p-5">
            <p className="text-[13px] text-white/75">{f.totalDue}</p>
            <p className="num mt-1 text-[30px] font-bold leading-none">{money(summary.outstanding_now)}</p>
            {summary.overdue_now > 0 && <p className="num mt-2 text-sm text-gold">{f.overdue}: {money(summary.overdue_now)}</p>}
          </div>
          <Card className="p-4">
            <IconChip icon={Wallet} tint="green" size={36} />
            <p className="num mt-3 text-xl font-bold">{money(summary.collected_gross)}</p>
            <p className="text-[13px] text-ink-2">{f.collectedMonth}</p>
          </Card>
          <Card className="p-4">
            <IconChip icon={AlertCircle} tint="rose" size={36} />
            <p className="num mt-3 text-xl font-bold">{money(summary.overdue_now)}</p>
            <p className="text-[13px] text-ink-2">{f.overdue}</p>
          </Card>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-3">
        {can(ctx, "fees.configure") && <Tile href="/fees/setup" icon={Settings2} tint="blue" label={f.setup} />}
        <Tile href="/payments" icon={Receipt} tint="teal" label={f.paymentsTitle} />
      </div>

      {can(ctx, "fees.invoice") && <div className="mt-3"><BillMonth thisMonth={today.slice(0, 7)} bnDigits={bn.bnDigits} /></div>}

      <SectionTitle>{f.collect}</SectionTitle>
      <SearchBox placeholder={f.search} label={f.search} />

      {found ? (
        <Card className="mt-3 overflow-hidden">
          {found.rows.length === 0 ? <EmptyState icon={Wallet2} title={t.students.noMatch} /> : (
            <ul className="divide-y divide-line/70">
              {found.rows.map((r) => (
                <li key={r.id}>
                  <ListRow href={`/fees/student/${r.id}`} leading={<Avatar name={displayName(r, locale)} id={r.id} src={r.photo_path ? photos[r.photo_path] : null} />}
                    title={displayName(r, locale)}
                    subtitle={[className(r, locale), r.roll_no && `${t.students.roll} ${formatNumber(r.roll_no, bn)}`].filter(Boolean).join(" · ")} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : (
        <>
          <SectionTitle>{f.dueStudents}</SectionTitle>
          <Card className="overflow-hidden">
            {!dues?.length ? <EmptyState icon={Wallet2} title={f.noDues} /> : (
              <ul className="divide-y divide-line/70">
                {dues.map((d) => (
                  <li key={d.student_id}>
                    <ListRow href={`/fees/student/${d.student_id}`}
                      leading={<Avatar name={displayName(d.student, locale)} id={d.student_id} src={d.student.photo_path ? photos[d.student.photo_path] : null} />}
                      title={displayName(d.student, locale)}
                      subtitle={[className(d.student, locale), d.student.roll_no && `${t.students.roll} ${formatNumber(d.student.roll_no, bn)}`].filter(Boolean).join(" · ")}
                      trailing={<Chip tint={d.overdue > 0 ? "rose" : "amber"} className="num">{money(d.outstanding)}</Chip>} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/fees">) {
  return <Suspense fallback={<div className="space-y-3"><Skeleton className="h-12 w-40" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>}><Fees searchParams={searchParams} /></Suspense>;
}
