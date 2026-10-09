import { Suspense } from "react";
import Link from "next/link";
import { CalendarCheck, HandCoins, Megaphone, UserPlus, ChartColumn, Wallet, CircleCheck, Circle, GraduationCap, Users, UserRound, TrendingUp, Landmark, AlertCircle, ChevronRight } from "lucide-react";
import { can, requireContext, type AppContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getSchool } from "@/lib/data/school";
import { dhakaHour, dhakaToday, formatDate, formatNumber, formatTaka } from "@/lib/format";
import { Card, Skeleton } from "@/components/ui";
import { HeroBand, IconChip, SectionTitle, Tile, type Tint } from "@/components/page";
import type { LucideIcon } from "lucide-react";
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

  const [countsRes, dayRes, monthRes, yearRes, seriesRes, feeRes, { data: me }] = await Promise.all([
    supabase.rpc("dashboard_counts", { p_school: ctx.schoolId }),
    finance ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: today, p_to: today }) : null,
    finance ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: monthStart(today), p_to: today }) : null,
    finance ? supabase.rpc("finance_summary", { p_school: ctx.schoolId, p_from: yearStart(today), p_to: today }) : null,
    finance ? supabase.rpc("monthly_income_expense", { p_school: ctx.schoolId, p_from: monthsBack(today, 11), p_to: today }) : null,
    supabase.from("fee_structures").select("id", { count: "exact", head: true }).eq("school_id", ctx.schoolId),
    supabase.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
  ]);
  const displayName = me?.full_name || ctx.email?.split("@")[0] || "";
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
    { done: Boolean(school.phone && school.head_teacher_name), label: t.dashboard.setupProfile, href: "/settings" },
    { done: (feeRes.count ?? 0) > 0, label: t.dashboard.setupFees, href: "/fees" },
    { done: c.staff > 0, label: t.dashboard.setupStaff, href: "/staff" },
    { done: c.students_total > 0, label: t.dashboard.setupStudents, href: "/students" },
  ] : [];
  const setupOpen = setup.some((s) => !s.done);

  const done = setup.filter((x) => x.done).length;
  const stats: { icon: LucideIcon; tint: Tint; label: string; value: string; sub?: string; href?: string }[] = [
    { icon: GraduationCap, tint: "orange", label: t.dashboard.students, value: n(c.students_active), sub: `${t.dashboard.admissions}: ${n(c.admissions_this_year)}`, href: "/students" },
    { icon: CalendarCheck, tint: "green", label: t.dashboard.present,
      value: c.marked_today ? `${n(c.present_today)}` : "—",
      sub: c.marked_today ? `${t.dashboard.absent}: ${n(c.absent_today)}` : t.dashboard.attendanceNotTaken, href: "/attendance" },
    ...(finance ? [
      { icon: Wallet, tint: "teal" as Tint, label: t.dashboard.collectedMonth, value: money(month?.collected_gross), href: "/payments" },
      { icon: AlertCircle, tint: "amber" as Tint, label: t.dashboard.outstanding, value: money(month?.outstanding_now),
        sub: (month?.overdue_now ?? 0) > 0 ? `${t.dashboard.overdue}: ${money(month?.overdue_now)}` : undefined, href: "/fees" },
      { icon: Landmark, tint: "blue" as Tint, label: t.dashboard.collectedYear, value: money(year?.collected_gross), href: "/reports" },
      { icon: TrendingUp, tint: "violet" as Tint, label: t.dashboard.surplusMonth, value: money(month?.surplus),
        sub: `${t.dashboard.expenses}: ${money(month?.expenses_approved)}`, href: "/reports" },
    ] : []),
    { icon: UserRound, tint: "slate", label: t.dashboard.staff, value: n(c.staff), href: "/staff" },
    { icon: Users, tint: "rose", label: t.dashboard.guardians, value: n(c.guardians), href: "/guardians" },
  ];

  return (
    <div>
      <h1 className="sr-only">{t.nav.dashboard}</h1>
      <HeroBand>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={school.logoUrl} alt="" aria-hidden className="pointer-events-none absolute -right-8 -top-2 size-44 opacity-[0.09]" />
        <p className="text-white/75">{greeting},</p>
        <p className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{displayName}</p>
        <p className="mt-2 inline-flex rounded-full bg-white/12 px-3 py-1 text-[13px] ring-1 ring-white/15">
          {formatDate(today, locale, bn)}
        </p>
        {finance ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[20px] bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[13px] text-white/75">{t.dashboard.collectedToday}</p>
              <p className="num mt-1 text-[22px] font-bold">{money(day?.collected_gross)}</p>
            </div>
            <div className="rounded-[20px] bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
              <p className="text-[13px] text-white/75">{t.nav.attendance}</p>
              <p className="num mt-1 text-[22px] font-bold">{attendancePct !== null ? `${n(attendancePct)}%` : "—"}</p>
            </div>
          </div>
        ) : null}
      </HeroBand>

      {setupOpen && (
        <Card className="rise p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">{t.dashboard.setupTitle}</h2>
            <span className="num text-sm font-semibold text-ink-2">{n(done)}/{n(setup.length)}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-gradient-to-r from-sun to-gold transition-all" style={{ width: `${(done / setup.length) * 100}%` }} />
          </div>
          <ol className="mt-4 space-y-2">
            {setup.map((x) => (
              <li key={x.href}>
                <Link href={x.href} className="press flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
                  {x.done ? <CircleCheck className="size-5 shrink-0 text-paid" aria-label="done" /> : <Circle className="size-5 shrink-0 text-ink-2/50" aria-label="to do" />}
                  <span className={x.done ? "flex-1 text-ink-2 line-through" : "flex-1 font-medium"}>{x.label}</span>
                  {!x.done && <ChevronRight className="size-4 text-ink-2/50" aria-hidden />}
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <QuickActions ctx={ctx} t={t} />

      <SectionTitle>{t.dashboard.today}</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {stats.map((x) => {
          const inner = (
            <>
              <IconChip icon={x.icon} tint={x.tint} size={40} />
              <p className="num mt-3 truncate text-[22px] font-bold leading-none">{x.value}</p>
              <p className="mt-1.5 text-[13px] font-medium text-ink-2">{x.label}</p>
              {x.sub && <p className="num mt-0.5 truncate text-xs text-ink-2/80">{x.sub}</p>}
            </>
          );
          return x.href
            ? <Link key={x.label} href={x.href} className="press block rounded-[22px] bg-surface p-4 card-shadow">{inner}</Link>
            : <div key={x.label} className="rounded-[22px] bg-surface p-4 card-shadow">{inner}</div>;
        })}
      </div>
      {finance && (month?.unverified_wallet_bank ?? 0) > 0 && (
        <p className="mt-2 px-1 text-xs text-ink-2">
          {t.dashboard.collectedMonth} {t.dashboard.unverifiedNote}: <span className="num">{money(month?.unverified_wallet_bank)}</span>
        </p>
      )}

      {c.pending_expenses > 0 && can(ctx, "expenses.approve") && (
        <Link href="/expenses?status=pending" className="press mt-3 flex items-center gap-3 rounded-[22px] bg-surface p-4 card-shadow">
          <IconChip icon={HandCoins} tint="rose" size={40} />
          <span className="flex-1 font-medium">{t.dashboard.pendingApprovals}</span>
          <span className="num rounded-full bg-sun px-2.5 py-0.5 text-sm font-bold text-white">{n(c.pending_expenses)}</span>
        </Link>
      )}

      {finance && (
        <>
          <SectionTitle>{t.dashboard.monthlyChart}</SectionTitle>
          <Card className="p-4">
            {hasSeries ? <IncomeExpenseChart data={series} bnDigits={bn.bnDigits} />
              : <p className="py-6 text-center text-sm text-ink-2">{t.dashboard.noData}</p>}
          </Card>
        </>
      )}
    </div>
  );
}

function QuickActions({ ctx, t }: { ctx: AppContext; t: Dictionary }) {
  const items: { show: boolean; href: string; label: string; icon: LucideIcon; tint: Tint }[] = [
    { show: can(ctx, "students.create"), href: "/students/new", label: t.dashboard.qaAddStudent, icon: UserPlus, tint: "orange" },
    { show: can(ctx, "attendance.create") || ctx.teachesSections.length > 0, href: "/attendance", label: t.dashboard.qaAttendance, icon: CalendarCheck, tint: "green" },
    { show: can(ctx, "fees.collect"), href: "/fees", label: t.dashboard.qaCollect, icon: Wallet, tint: "teal" },
    { show: can(ctx, "expenses.create"), href: "/expenses", label: t.dashboard.qaExpense, icon: HandCoins, tint: "rose" },
    { show: can(ctx, "notices.manage") || ctx.teachesSections.length > 0, href: "/notices", label: t.dashboard.qaNotice, icon: Megaphone, tint: "violet" },
    { show: can(ctx, "reports.view"), href: "/reports", label: t.dashboard.qaReport, icon: ChartColumn, tint: "blue" },
  ];
  const shown = items.filter((i) => i.show);
  if (!shown.length) return null;
  return (
    <>
      <SectionTitle>{t.dashboard.quickActions}</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {shown.map((i) => <Tile key={i.href} href={i.href} icon={i.icon} tint={i.tint} label={i.label} />)}
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="space-y-4"><Skeleton className="-mx-3 -mt-4 h-60 rounded-t-none" /><Skeleton className="h-40" /><div className="grid grid-cols-3 gap-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-24" />)}</div></div>}>
      <Dashboard />
    </Suspense>
  );
}
