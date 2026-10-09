"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LayoutGrid, Monitor, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { NavItem } from "@/lib/nav";
import { NavIcon } from "./icon";
import { LanguageSwitch } from "./language-switch";
import { SignOutButton } from "./sign-out";
import { applyTheme, readTheme, subscribePrefs, type Theme } from "@/lib/client-prefs";

export type ShellProps = {
  school: { name: string; place: string; logoUrl: string };
  user: { name: string; email: string; role: string };
  yearName: string | null;
  nav: NavItem[];
  bottom: NavItem[];
  unread: number;
  children: React.ReactNode;
};

const NAV_TINT: Partial<Record<string, string>> = {
  dashboard: "blue", students: "orange", guardians: "violet", teachers: "teal", attendance: "green",
  classes: "blue", homework: "amber", exams: "violet", fees: "green", payments: "teal", expenses: "rose",
  reports: "blue", notices: "orange", staff: "slate", settings: "slate", help: "teal",
};

/** Phone-width app frame. On a computer it is centred, so it looks and works like the phone app. */
export const FRAME = "mx-auto w-full max-w-[480px]";

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/portal" && pathname.startsWith(href + "/"));
}

export function AppShell({ school, user, yearName, nav, bottom, unread, children }: ShellProps) {
  const { t } = useT();
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const inBottom = new Set(bottom.map((b) => b.href));
  const more = nav.filter((n) => !inBottom.has(n.href));
  const moreActive = more.some((m) => isActive(pathname, m.href));

  return (
    <div className="min-h-dvh bg-[color-mix(in_oklab,var(--brand)_8%,var(--bg))]">
      <div className={cn(FRAME, "relative flex min-h-dvh flex-col bg-bg sm:shadow-2xl sm:shadow-brand/15")}>
        {/* Top app bar */}
        <header className="brand-band no-print sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
          <div className="flex h-[68px] items-center gap-3 px-4">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={school.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={school.logoUrl} alt="" className="size-11 shrink-0 rounded-2xl bg-white object-contain p-0.5 shadow-md shadow-black/20" />
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-bold leading-tight">{school.name}</span>
                <span className="block truncate text-xs text-white/70">
                  {yearName ? `${t.common.academicYear} ${yearName}` : school.place}
                </span>
              </span>
            </Link>
            <Link href="/notifications" className="press relative grid size-11 place-items-center rounded-2xl bg-white/12 ring-1 ring-white/20 hover:bg-white/20" aria-label={t.common.notifications}>
              <Bell className="size-[22px]" />
              {unread > 0 && (
                <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sun px-1 text-[11px] font-bold text-white ring-2 ring-brand-deep">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <ProfileMenu user={user} />
          </div>
        </header>

        <main className="flex-1 px-3 pt-4 pb-32">{children}</main>

        {/* Floating bottom tab bar */}
        <div className={cn(FRAME, "no-print fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(10px+env(safe-area-inset-bottom))]")}>
          <nav aria-label={t.nav.menu}
            className="float-shadow grid rounded-[26px] bg-surface/92 p-1.5 backdrop-blur-xl ring-1 ring-line/60"
            style={{ gridTemplateColumns: `repeat(${bottom.length + (more.length ? 1 : 0)}, minmax(0,1fr))` }}>
            {bottom.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                  className={cn("press flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-medium transition-colors",
                    active ? "bg-brand text-white" : "text-ink-2 hover:text-ink")}>
                  <NavIcon name={i.icon} className="size-[22px]" />
                  <span className="max-w-full truncate px-1">{t.nav[i.key]}</span>
                </Link>
              );
            })}
            {more.length > 0 && (
              <button onClick={() => setSheet(true)} aria-expanded={sheet}
                className={cn("press flex flex-col items-center gap-0.5 rounded-[20px] py-2 text-[11px] font-medium",
                  moreActive ? "bg-brand text-white" : "text-ink-2 hover:text-ink")}>
                <LayoutGrid className="size-[22px]" aria-hidden />
                {t.nav.more}
              </button>
            )}
          </nav>
        </div>

        {/* "More" sheet: every other section as a big-tap grid */}
        {sheet && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.nav.more}>
            <button className="absolute inset-0 bg-black/45" aria-label={t.common.cancel} onClick={() => setSheet(false)} />
            <div className={cn(FRAME, "rise absolute inset-x-0 bottom-0 rounded-t-[32px] bg-bg px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]")}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold">{t.nav.more}</h2>
                <button onClick={() => setSheet(false)} className="rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label={t.common.cancel}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {more.map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setSheet(false)}
                    className={cn("press flex flex-col items-center gap-2 rounded-[22px] bg-surface px-1 pb-3 pt-4 text-center text-[13px] font-medium card-shadow",
                      isActive(pathname, i.href) && "ring-2 ring-accent")}>
                    <span className={cn("grid size-12 place-items-center rounded-2xl", `tint-${NAV_TINT[i.key] ?? "slate"}`)}>
                      <NavIcon name={i.icon} className="size-6" />
                    </span>
                    {t.nav[i.key]}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileMenu({ user }: { user: ShellProps["user"] }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore<Theme>(subscribePrefs, readTheme, () => "system");
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <>
      <button onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog" aria-label={t.nav.profile}
        className="press grid size-11 shrink-0 place-items-center rounded-2xl bg-gold text-sm font-bold text-brand-deep shadow-md shadow-black/20">
        {initials}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 text-ink" role="dialog" aria-modal="true" aria-label={t.nav.profile}>
          <button className="absolute inset-0 bg-black/45" aria-label={t.common.cancel} onClick={() => setOpen(false)} />
          <div className={cn(FRAME, "rise absolute inset-x-0 bottom-0 rounded-t-[32px] bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]")}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" aria-hidden />
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="truncate text-sm text-ink-2">{user.email}</p>
            <p className="mt-2 inline-block rounded-full bg-sky px-3 py-0.5 text-sm">{user.role}</p>
            <p className="mt-5 mb-2 text-sm text-ink-2">ভাষা / Language</p>
            <LanguageSwitch />
            <p className="mt-5 mb-2 text-sm text-ink-2">{t.common.theme}</p>
            <div className="grid grid-cols-3 gap-2">
              {([["light", Sun, t.common.light], ["dark", Moon, t.common.dark], ["system", Monitor, t.common.system]] as const).map(([v, I, label]) => (
                <button key={v} onClick={() => applyTheme(v)} aria-pressed={theme === v}
                  className={cn("flex flex-col items-center gap-1 rounded-2xl border py-3 text-sm",
                    theme === v ? "border-accent bg-sky text-ink" : "border-line text-ink-2")}>
                  <I className="size-5" aria-hidden />{label}
                </button>
              ))}
            </div>
            <SignOutButton label={t.common.signOut} className="mt-6 w-full" />
          </div>
        </div>
      )}
    </>
  );
}
