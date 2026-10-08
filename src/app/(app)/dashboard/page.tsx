import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheck, HandCoins, Megaphone, Plus, ChartColumn, Wallet, CircleCheck, Circle } from "lucide-react";
import { can, requireContext, type AppContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSchool, schoolName, schoolPlace } from "@/lib/data/school";
import { dhakaHour, dhakaToday, formatDate, formatNumber, formatTaka } from "@/lib/format";
import { Card, Skeleton } from "@/components/ui";
import { IncomeExpenseChart, type MonthPoint } from "@/components/charts/income-expense";
import type { Dictionary } from "@/lib/i18n";

export const metadata = { title: "Dashboard" };

type Counts = {
  students_total: number; students_active: number; admissions_this_year: number; teachers: number;
  staff: number; guardians: number; present_today: number; absent_today: number; marked_today: number;
  pending_expenses: number; today: string;
};
type Summary = {
  collected_gross: number; net_collected: number; refunds: number; expenses_approved: number;
  surplus: number; outstanding_now: number; overdue_now: number; unverified_wallet_bank: number;
};

function monthStart(d: string) { return d.slice(0, 8) + "01"; }
function yearStart(d: string) { return d.slice(0, 5) + "01-01"; }
function monthsBack(d: string, n: number) {
  const [y, m] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 - n, 1));
  return dt.toISOString().slice(0, 10);
}

async function Dashboard() {
  const ctx = await requireContext();
  const [{ locale, t }, school, supabase] = await Promise.all([getT(), getSchool(ctx.schoolId), supabaseServer()]);
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const today = dhakaToday();
  const finance = can(ctx, "reports.view");

  const [countsRes, dayRes, monthRes, yearRes, seriesRes, feeRes] = await Promise.all([
    supabase.rpc("dashboard_counts", { p_school: ctx.schoolId }),
    finance ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: today, p_to: today }) : null,
    finance ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: monthStart(today), p_to: today }) : null,
    finance ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: yearStart(today), p_to: today }) : null,
    finance ? supabase.rpc("monthly_income_expense", { p_school: ctx.schoolId, p_from: monthsBack(today, 11), p_to: today }) : null,
    supabase.from("fee_structures").select("id", { count: "exact", head: true }).eq("school_id", ctx.schoolId),
  ]);
  if (countsRes.error) throw countsRes.error;
  const c = countsRes.data as Counts;
  const day = dayRes?.data as Summary | undefined;
  const month = monthRes?.data as Summary | undefined;
  const year = yearRes?.data as Summary | undefined;

  const hour = dhakaHour();
  const greeting = hour < 12 ? t.dashboard.greetingMorning : hour < 17 ? t.dashboard.greetingAfternoon : t.dashboard.greetingEvening;
  const n = (v: number) => formatNumber(v, bn);
  const money = (v: number | undefined) => formatTaka(v ?? 0, bn);
  const attendancePct = c.marked_today > 0 ? Math.round((c.present_today / c.marked_today) * 100) : null;

  const series: MonthPoint[] = ((seriesRes?.data ?? []) as { month: string; collected: number; expenses: number }[])
    .map((r) => ({
      label: new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "short", timeZone: "UTC" }).format(new Date(r.month)),
      collected: Number(r.collected), expenses: Number(r.expenses),
    }));
  const hasSeries = series.some((s) => s.collected > 0 || s.expenses > 0);

  const setup = ctx.role === "super_admin" ? [
    { done: Boolean(school.logo_path && school.phone), label: t.dashboard.setupProfile, href: "/settings" },
    { done: (feeRes.count ?? 0) > 0, label: t.dashboard.setupFees, href: "/fees" },
    { done: c.staff > 0, label: t.dashboard.setupStaff, href: "/staff" },
    { done: c.students_total > 0, label: t.dashboard.setupStudents, href: "/students" },
  ] : [];
  const setupOpen = setup.some((s) => !s.done);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Identity band: the one decorated element on the page */}
      <section className="relative overflow-hidden rounded-3xl bg-brand px-5 py-6 text-white sm:px-8 sm:py-8">
        <p className="text-white/80">{greeting}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">{schoolName(school, locale)}</h1>
        <p className="mt-1 text-sm text-white/70">{schoolPlace(school)}</p>
        <div className="stitch my-4 w-48 text-due/90" aria-hidden />
        <p className="text-sm text-white/85">{t.dashboard.today}: {formatDate(today, locale, bn)}</p>
      </section>

      {setupOpen && (
        <Card className="p-5">
          <h2 className="font-semibold">{t.dashboard.setupTitle}</h2>
          <p className="mt-1 text-sm text-ink-2">{t.dashboard.setupBody}</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {setup.map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="flex items-center gap-3 rounded-xl border border-line px-3 py-3 hover:bg-surface-2">
                  {s.done ? <CircleCheck className="size-5 text-paid" aria-label="done" /> : <Circle className="size-5 text-ink-2" aria-label="to do" />}
                  <span className={s.done ? "text-ink-2 line-through" : ""}>{s.label}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-semibold">{t.dashboard.today}</h2>
          {c.marked_today === 0 ? (
            <p className="mt-3 text-ink-2">{t.dashboard.attendanceNotTaken}</p>
          ) : (
            <div className="mt-3 flex items-end gap-6">
              <div>
                <p className="num text-4xl font-bold text-ink">{attendancePct !== null ? n(attendancePct) + "%" : "—"}</p>
                <p className="text-sm text-ink-2">{t.nav.attendance}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 text-sm">
                <dt className="text-ink-2">{t.dashboard.present}</dt><dd className="num font-semibold text-paid">{n(c.present_today)}</dd>
                <dt className="text-ink-2">{t.dashboard.absent}</dt><dd className="num font-semibold text-danger">{n(c.absent_today)}</dd>
              </dl>
            </div>
          )}
          {finance && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="text-sm text-ink-2">{t.dashboard.collectedToday}</p>
              <p className="num text-2xl font-bold">{money(day?.collected_gross)}</p>
            </div>
          )}
        </Card>

        {/* Money */}
        {finance && (
          <Card className="p-5 lg:col-span-2">
            <div className="grid gap-5 sm:grid-cols-2">
              <Metric label={t.dashboard.collectedMonth} value={money(month?.collected_gross)} />
              <Metric label={t.dashboard.collectedYear} value={money(year?.collected_gross)} />
              <Metric label={t.dashboard.outstanding} value={money(month?.outstanding_now)} tone="due"
                sub={(month?.overdue_now ?? 0) > 0 ? `${t.dashboard.overdue}: ${money(month?.overdue_now)}` : undefined} />
              <Metric label={t.dashboard.surplusMonth} value={money(month?.surplus)}
                sub={`${t.dashboard.expensesMonth}: ${money(month?.expenses_approved)}`} />
            </div>
            {(month?.unverified_wallet_bank ?? 0) > 0 && (
              <p className="mt-4 text-xs text-ink-2">
                {t.dashboard.collectedMonth} {t.dashboard.unverifiedNote}: <span className="num">{money(month?.unverified_wallet_bank)}</span>
              </p>
            )}
          </Card>
        )}
      </div>

      {/* People */}
      <Card className="grid grid-cols-2 divide-line p-0 sm:grid-cols-4 sm:divide-x">
        <People label={t.dashboard.students} value={n(c.students_active)} />
        <People label={t.dashboard.admissions} value={n(c.admissions_this_year)} />
        <People label={t.dashboard.staff} value={n(c.staff)} />
        <People label={t.dashboard.guardians} value={n(c.guardians)} />
      </Card>

      <QuickActions ctx={ctx} t={t} pendingExpenses={c.pending_expenses} n={n} />

      {finance && (
        <Card className="p-5">
          <h2 className="font-semibold">{t.dashboard.monthlyChart}</h2>
          {hasSeries ? <div className="mt-4"><IncomeExpenseChart data={series} bnDigits={bn.bnDigits} /></div>
            : <p className="mt-3 text-ink-2">{t.dashboard.noData}</p>}
        </Card>
      )}
    </div>
  );
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "due" }) {
  return (
    <div className={tone === "due" ? "rounded-xl border-l-4 border-due pl-3" : ""}>
      <p className="text-sm text-ink-2">{label}</p>
      <p className="num mt-0.5 text-2xl font-bold">{value}</p>
      {sub && <p className="num mt-0.5 text-xs text-ink-2">{sub}</p>}
    </div>
  );
}
function People({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-5 py-4">
      <p className="num text-2xl font-bold">{value}</p>
      <p className="text-sm text-ink-2">{label}</p>
    </div>
  );
}

function QuickActions({ ctx, t, pendingExpenses, n }: { ctx: AppContext; t: Dictionary; pendingExpenses: number; n: (v: number) => string }) {
  const items = [
    { show: can(ctx, "students.create"), href: "/students/new", label: t.dashboard.qaAddStudent, Icon: Plus },
    { show: can(ctx, "attendance.create") || ctx.teachesSections.length > 0, href: "/attendance", label: t.dashboard.qaAttendance, Icon: CalendarCheck },
    { show: can(ctx, "fees.collect"), href: "/fees", label: t.dashboard.qaCollect, Icon: Wallet },
    { show: can(ctx, "expenses.create"), href: "/expenses", label: t.dashboard.qaExpense, Icon: HandCoins },
    { show: can(ctx, "notices.manage") || ctx.teachesSections.length > 0, href: "/notices", label: t.dashboard.qaNotice, Icon: Megaphone },
    { show: can(ctx, "reports.view"), href: "/reports", label: t.dashboard.qaReport, Icon: ChartColumn },
  ].filter((i) => i.show);
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-semibold">{t.dashboard.quickActions}</h2>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {items.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl bg-surface border border-line px-2 py-4 text-center text-sm hover:border-accent">
            <span className="grid size-11 place-items-center rounded-full bg-sky text-brand"><Icon className="size-5" aria-hidden /></span>
            {label}
          </Link>
        ))}
      </div>
      {pendingExpenses > 0 && can(ctx, "expenses.approve") && (
        <Link href="/expenses?status=pending" className="mt-3 inline-block text-sm text-accent hover:underline">
          {t.dashboard.pendingApprovals}: <span className="num">{n(pendingExpenses)}</span>
        </Link>
      )}
    </section>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl space-y-6"><Skeleton className="h-44" /><Skeleton className="h-48" /><Skeleton className="h-24" /></div>}>
      <Dashboard />
    </Suspense>
  );
}
