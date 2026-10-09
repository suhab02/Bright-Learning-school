import { Suspense } from "react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { schoolToday } from "@/lib/data/attendance";
import { validDate } from "@/lib/attendance/shared";
import { formatTaka } from "@/lib/format";
import { Card, Field, Input, Button, Notice, Skeleton } from "@/components/ui";
import { PageHeader, SectionTitle } from "@/components/page";
import { ReportTools } from "@/components/report-tools";
import { type Row, str, named } from "@/lib/workflows/data";
async function Reports({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireContext();
  const [{ locale, t }, sp, today, db] = await Promise.all([
    getT(),
    searchParams,
    schoolToday(ctx.schoolId),
    supabaseServer(),
  ]);
  const L = (en: string, bn: string) => (locale === "bn" ? bn : en);
  if (!can(ctx, "reports.view"))
    return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const from = typeof sp.from === "string" ? sp.from : today.slice(0, 8) + "01",
    to = typeof sp.to === "string" ? sp.to : today;
  if (!validDate(from) || !validDate(to) || to < from)
    return (
      <Notice tone="error">
        {L("Choose a valid date range.", "সঠিক তারিখের সীমা নির্বাচন করুন।")}
      </Notice>
    );
  const [finance, operations] = await Promise.all([
    db.rpc("finance_summary", {
      p_school: ctx.schoolId,
      p_from: from,
      p_to: to,
    }),
    db.rpc("school_operational_report", {
      p_school: ctx.schoolId,
      p_from: from,
      p_to: to,
    }),
  ]);
  if (finance.error || operations.error)
    throw finance.error || operations.error;
  const f = finance.data as Row;
  const o = operations.data as {
    active_students: number;
    attendance: Record<string, number>;
    by_class: Row[];
  };
  const metrics: [string, string][] = [
    ["collected_gross", L("Collections", "আদায়")],
    ["refunds", L("Refunds", "ফেরত")],
    ["net_collected", L("Net collections", "নিট আদায়")],
    ["expenses_approved", L("Approved expenses", "অনুমোদিত ব্যয়")],
    ["expenses_pending", L("Pending expenses", "অপেক্ষমান ব্যয়")],
    ["surplus", L("Surplus", "উদ্বৃত্ত")],
    ["billed", L("Billed in date range", "নির্বাচিত সময়ের ধার্য ফি")],
    ["discounts", L("Discounts / waivers", "ছাড় / মওকুফ")],
    [
      "outstanding_now",
      L("Current outstanding (all dates)", "বর্তমান মোট বকেয়া (সব তারিখ)"),
    ],
    ["overdue_now", L("Current overdue", "বর্তমান মেয়াদোত্তীর্ণ বকেয়া")],
    [
      "unverified_wallet_bank",
      L(
        "Unverified wallet / bank collections",
        "যাচাই না করা ওয়ালেট / ব্যাংক আদায়",
      ),
    ],
  ];
  const decimal = (value: unknown) => {
    const n = BigInt(String(value ?? 0)),
      a = n < 0n ? -n : n;
    return `${n < 0n ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
  };
  const csv = [
    "Metric,Amount (BDT)",
    ...metrics.map(
      ([key, label]) => `"${label.replaceAll('"', '""')}",${decimal(f[key])}`,
    ),
  ].join("\r\n");
  return (
    <div>
      <PageHeader title={t.nav.reports} />
      <Card className="mb-4 p-4 print:hidden">
        <form method="get" className="space-y-3">
          <Field label={L("From", "শুরু")} htmlFor="report-from">
            <Input
              id="report-from"
              type="date"
              name="from"
              defaultValue={from}
              required
            />
          </Field>
          <Field label={L("To", "শেষ")} htmlFor="report-to">
            <Input
              id="report-to"
              type="date"
              name="to"
              defaultValue={to}
              required
            />
          </Field>
          <Button className="w-full">
            {L("View report", "প্রতিবেদন দেখুন")}
          </Button>
        </form>
      </Card>
      <p className="mb-3 text-sm text-ink-2">
        {from} — {to}
      </p>
      <ReportTools
        locale={locale}
        filename={`school-report-${from}-${to}.csv`}
        csv={can(ctx, "reports.export") ? csv : undefined}
      />
      <Card className="p-4">
        <dl className="divide-y divide-line">
          {metrics.map(([key, label]) => (
            <div key={key} className="flex justify-between gap-3 py-3">
              <dt className="text-sm">{label}</dt>
              <dd className="shrink-0 font-bold">
                {formatTaka(str(f, key) || "0")}
              </dd>
            </div>
          ))}
        </dl>
      </Card>
      <SectionTitle>
        {L("Collections by method", "মাধ্যম অনুযায়ী আদায়")}
      </SectionTitle>
      <Card className="p-4">
        {Object.entries(
          (f.collected_by_method ?? {}) as Record<string, number>,
        ).map(([key, amount]) => (
          <p key={key} className="flex justify-between gap-3 py-2">
            <span>
              {t.fees.methods[key as keyof typeof t.fees.methods] || key}
            </span>
            <span>{formatTaka(amount)}</span>
          </p>
        ))}
      </Card>
      <SectionTitle>
        {L("Students", "শিক্ষার্থী")}: {o.active_students}
      </SectionTitle>
      <Card className="p-4">
        {o.by_class.map((c, i) => (
          <p key={i} className="flex justify-between py-2">
            <span>{named(c, locale)}</span>
            <span>{str(c, "students")}</span>
          </p>
        ))}
      </Card>
      <SectionTitle>{t.nav.attendance}</SectionTitle>
      <Card className="p-4">
        {["present", "absent", "late", "excused"].map((status, i) => (
          <p key={status} className="flex justify-between py-2">
            <span>
              {L(
                ["Present", "Absent", "Late", "Excused"][i],
                ["উপস্থিত", "অনুপস্থিত", "দেরিতে", "অনুমতিপ্রাপ্ত"][i],
              )}
            </span>
            <span>{o.attendance[status] ?? 0}</span>
          </p>
        ))}
        <p className="mt-3 text-xs text-ink-2">
          {L(
            "Counts are recorded attendance entries, not unique students.",
            "সংখ্যাগুলো হাজিরা রেকর্ডের, স্বতন্ত্র শিক্ষার্থীর নয়।",
          )}
        </p>
      </Card>
    </div>
  );
}
export default function Page({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}
