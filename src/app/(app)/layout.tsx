import { Suspense } from "react";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { supabaseServer } from "@/lib/supabase/server";
import { getSchool, isHexColor, schoolName, schoolPlace } from "@/lib/data/school";
import { bottomNav, visibleNav } from "@/lib/nav";
import { AppShell } from "@/components/app-shell";
import { Skeleton } from "@/components/ui";

async function Shell({ children }: { children: React.ReactNode }) {
  const ctx = await requireContext();
  const [{ locale, t }, school, supabase] = await Promise.all([getT(), getSchool(ctx.schoolId), supabaseServer()]);
  const [{ data: year }, { count: unread }, { data: profile }] = await Promise.all([
    supabase.from("academic_years").select("name").eq("school_id", ctx.schoolId).eq("is_current", true).maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
  ]);
  const nav = visibleNav(ctx.role, [...ctx.permissions]);
  const brand = isHexColor(school.primary_color) ? school.primary_color : "#17356B";

  return (
    <LocaleProvider locale={locale}>
      <div style={{ ["--brand" as string]: brand }}>
        <AppShell
          school={{ name: schoolName(school, locale), place: schoolPlace(school), logoUrl: school.logoUrl }}
          user={{ name: profile?.full_name || ctx.email || "", email: ctx.email ?? "", role: t.roles[ctx.role] }}
          yearName={year?.name ?? null}
          nav={nav}
          bottom={bottomNav(ctx.role, nav)}
          unread={unread ?? 0}>
          {children}
        </AppShell>
      </div>
    </LocaleProvider>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-64 bg-brand lg:block" />
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<ShellSkeleton />}><Shell>{children}</Shell></Suspense>;
}
