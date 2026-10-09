import { Suspense } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { listPayments } from "@/lib/data/fees";
import { displayName } from "@/lib/data/students";
import { dhakaToday, formatDate, formatNumber, formatTaka, toBnDigits } from "@/lib/format";
import { Card, Notice, Skeleton } from "@/components/ui";
import { Avatar, Chip, EmptyState, ListRow, PageHeader } from "@/components/page";
import { cn } from "@/lib/cn";

export const metadata = { title: "Payments" };

async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  const [sp, { locale, t }, school] = await Promise.all([searchParams, getT(), getSchool(ctx.schoolId)]);
  const f = t.fees;
  if (!can(ctx, "fees.view")) return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const money = (v: number) => formatTaka(v, bn);
  const today = dhakaToday();
  const range = sp.range === "month" ? "month" : "today";
  const from = range === "month" ? today.slice(0, 8) + "01" : today;
  const rows = await listPayments(from, today);
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const total = confirmed.reduce((s, r) => s + r.amount, 0);
  const byMethod = Object.entries(confirmed.reduce<Record<string, number>>((m, r) => ({ ...m, [r.method]: (m[r.method] ?? 0) + r.amount }), {}));

  return (
    <div>
      <PageHeader title={f.paymentsTitle} back="/fees" />
      <div className="mb-3 flex gap-2">
        {(["today", "month"] as const).map((k) => (
          <Link key={k} href={k === "today" ? "/payments" : "/payments?range=month"} scroll={false}
            className={cn("press rounded-full px-4 py-2 text-sm font-semibold", range === k ? "bg-brand text-white" : "bg-surface text-ink-2 card-shadow")}>
            {k === "today" ? f.today : f.thisMonth}
          </Link>
        ))}
      </div>
      <div className="brand-band rounded-[22px] p-5">
        <p className="text-[13px] text-white/75">{f.collected} · {formatNumber(confirmed.length, bn)}</p>
        <p className="num mt-1 text-[30px] font-bold leading-none">{money(total)}</p>
        {byMethod.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {byMethod.map(([m, v]) => (
              <span key={m} className="num rounded-full bg-white/12 px-3 py-1 text-[13px] ring-1 ring-white/15">{f.methods[m as keyof typeof f.methods]}: {money(v)}</span>
            ))}
          </div>
        )}
      </div>
      <Card className="mt-4 overflow-hidden">
        {rows.length === 0 ? <EmptyState icon={Receipt} title={f.noPaymentsPeriod} /> : (
          <ul className="divide-y divide-line/70">
            {rows.map((r) => {
              const name = r.student ? displayName(r.student, locale) : "—";
              return (
                <li key={r.id}>
                  <ListRow href={`/receipts/${r.id}`} leading={<Avatar name={name} id={r.student_id} size={40} />}
                    title={name}
                    subtitle={[range === "month" ? formatDate(r.paid_on, locale, bn) : null, f.methods[r.method as keyof typeof f.methods], bn.bnDigits ? toBnDigits(r.receipt_no) : r.receipt_no].filter(Boolean).join(" · ")}
                    trailing={r.status === "reversed" ? <Chip tint="rose">{f.reversed}</Chip> : <span className="num font-bold">{money(r.amount)}</span>} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page({ searchParams }: PageProps<"/payments">) {
  return <Suspense fallback={<div className="space-y-3"><Skeleton className="h-12 w-40" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>}><Payments searchParams={searchParams} /></Suspense>;
}
