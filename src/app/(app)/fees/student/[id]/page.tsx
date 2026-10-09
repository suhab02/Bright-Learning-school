import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Receipt } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { getFeeSetup, getStudentLedger, periodLabel } from "@/lib/data/fees";
import { className, displayName, getStudent } from "@/lib/data/students";
import { dhakaToday, formatDate, formatNumber, formatTaka, toBnDigits } from "@/lib/format";
import { Card, Notice, Skeleton } from "@/components/ui";
import { Chip, EmptyState, ListRow, PageHeader, SectionTitle } from "@/components/page";
import { CollectForm } from "./collect-form";
import { AddChargeForm, DiscountForm, UseAdvanceButton } from "./small-forms";

export const metadata = { title: "Student fees" };

async function Ledger({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [{ locale, t }, school] = await Promise.all([getT(), getSchool(ctx.schoolId)]);
  if (!(can(ctx, "fees.view") || can(ctx, "fees.collect"))) return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const [st, ledger, setup] = await Promise.all([getStudent(id), getStudentLedger(id), getFeeSetup(ctx.schoolId)]);
  if (!st) notFound();
  const f = t.fees;
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const money = (v: number) => formatTaka(v, bn);
  const today = dhakaToday();
  const label = (c: { category_bn: string; category_en: string; billing_period: string | null; description: string | null }) =>
    [locale === "bn" ? c.category_bn : c.category_en, periodLabel(c.billing_period, locale) ?? c.description].filter(Boolean).join(" · ");
  const open = ledger.charges.filter((c) => c.status === "active" && c.outstanding > 0);
  const overdue = open.filter((c) => c.due_on < today).reduce((s, c) => s + c.outstanding, 0);

  return (
    <div>
      <PageHeader title={displayName(st, locale)} back="/fees"
        subtitle={[className(st, locale), st.roll_no && `${t.students.roll} ${formatNumber(st.roll_no, bn)}`].filter(Boolean).join(" · ")} />

      <div className="brand-band rounded-[22px] p-5">
        <p className="text-[13px] text-white/75">{f.dueNow}</p>
        <p className="num mt-1 text-[32px] font-bold leading-none">{money(ledger.due)}</p>
        {overdue > 0 && <p className="num mt-2 text-sm text-gold">{f.overdue}: {money(overdue)}</p>}
        {ledger.credit > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
            <span className="num text-sm">{f.advance}: <b>{money(ledger.credit)}</b></span>
            {open.length > 0 && can(ctx, "fees.collect") && <UseAdvanceButton studentId={id} />}
          </div>
        )}
      </div>

      {can(ctx, "fees.collect") && (
        <div className="mt-4">
          <CollectForm studentId={id} idempotencyKey={crypto.randomUUID()} bnDigits={bn.bnDigits}
            charges={open.map((c) => ({ id: c.item_id, label: label(c), outstanding: c.outstanding, overdue: c.due_on < today }))} />
        </div>
      )}

      <SectionTitle>{f.charges}</SectionTitle>
      <Card className="overflow-hidden">
        {ledger.charges.length === 0 ? <EmptyState icon={Receipt} title={f.noCharges} /> : (
          <ul className="divide-y divide-line/70">
            {ledger.charges.map((c) => {
              const state = c.status === "cancelled" ? "cancelled" : c.outstanding === 0 ? "paid" : c.paid + c.adjusted > 0 ? "partlyPaid" : "unpaid";
              const tint = state === "paid" ? "green" : state === "cancelled" ? "slate" : c.due_on < today ? "rose" : "amber";
              return (
                <li key={c.item_id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{label(c)}</p>
                      <p className="num text-[13px] text-ink-2">
                        {f.dueDate}: {formatDate(c.due_on, locale, bn)}
                        {c.adjusted > 0 && ` · ${f.discount} ${money(c.adjusted)}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="num font-bold">{money(c.amount)}</p>
                      <Chip tint={tint} className="mt-1">{f[state as "paid" | "partlyPaid" | "unpaid" | "cancelled"]}{state === "partlyPaid" && ` · ${money(c.outstanding)}`}</Chip>
                    </div>
                  </div>
                  {c.outstanding > 0 && c.status === "active" && can(ctx, "fees.adjust") && <div className="mt-2"><DiscountForm itemId={c.item_id} /></div>}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      {can(ctx, "fees.invoice") && <div className="mt-3"><AddChargeForm studentId={id} categories={setup.categories.filter((c) => c.is_active)} today={today} /></div>}

      <SectionTitle>{f.history}</SectionTitle>
      <Card className="overflow-hidden">
        {ledger.payments.length === 0 ? <EmptyState icon={Receipt} title={f.noPayments} /> : (
          <ul className="divide-y divide-line/70">
            {ledger.payments.map((p) => (
              <li key={p.id}>
                <ListRow href={`/receipts/${p.id}`}
                  title={<span className="num">{money(Number(p.amount))}</span>}
                  subtitle={[formatDate(p.paid_on, locale, bn), f.methods[p.method as keyof typeof f.methods], bn.bnDigits ? toBnDigits(p.receipt_no) : p.receipt_no].join(" · ")}
                  trailing={p.status === "reversed" ? <Chip tint="rose">{f.reversed}</Chip> : undefined} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default function Page({ params }: PageProps<"/fees/student/[id]">) {
  return <Suspense fallback={<div className="space-y-4"><Skeleton className="h-12 w-56" /><Skeleton className="h-36" /><Skeleton className="h-96" /></div>}><Ledger params={params} /></Suspense>;
}
