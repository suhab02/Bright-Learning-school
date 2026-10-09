"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Monitor, Moon, Sun, X } from "lucide-react";
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
        <header className="no-print sticky top-0 z-30 bg-brand text-white pt-[env(safe-area-inset-top)]">
          <div className="flex h-16 items-center gap-3 px-3">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={school.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={school.logoUrl} alt="" className="size-11 shrink-0 rounded-xl bg-white object-contain p-0.5" />
              <span className="min-w-0">
                <span className="block truncate font-semibold leading-tight">{school.name}</span>
                <span className="block truncate text-xs text-white/70">
                  {yearName ? `${t.common.academicYear} ${yearName}` : school.place}
                </span>
              </span>
            </Link>
            <Link href="/notifications" className="relative rounded-full p-2 hover:bg-white/10" aria-label={t.common.notifications}>
              <Bell className="size-6" />
              {unread > 0 && (
                <span className="num absolute right-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-sun px-1 text-[11px] font-bold text-white ring-2 ring-brand">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <ProfileMenu user={user} />
          </div>
        </header>

        <main className="flex-1 px-3 pt-4 pb-28">{children}</main>

        {/* Bottom tab bar — always visible, like a native app */}
        <nav aria-label={t.nav.menu}
          className={cn(FRAME, "no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]")}
          style={{ gridTemplateColumns: `repeat(${bottom.length + (more.length ? 1 : 0)}, minmax(0,1fr))` }}>
          {bottom.map((i) => {
            const active = isActive(pathname, i.href);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px]", active ? "text-brand dark:text-accent font-semibold" : "text-ink-2")}>
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition", active && "bg-sky")}>
                  <NavIcon name={i.icon} className="size-[22px]" />
                </span>
                {t.nav[i.key]}
              </Link>
            );
          })}
          {more.length > 0 && (
            <button onClick={() => setSheet(true)} aria-expanded={sheet}
              className={cn("flex flex-col items-center gap-0.5 pt-2 pb-2.5 text-[11px]", moreActive ? "text-brand dark:text-accent font-semibold" : "text-ink-2")}>
              <span className={cn("grid h-8 w-14 place-items-center rounded-full", moreActive && "bg-sky")}><Menu className="size-[22px]" aria-hidden /></span>
              {t.nav.more}
            </button>
          )}
        </nav>

        {/* "More" sheet: every other section as a big-tap grid */}
        {sheet && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.nav.more}>
            <button className="absolute inset-0 bg-black/45" aria-label={t.common.cancel} onClick={() => setSheet(false)} />
            <div className={cn(FRAME, "absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]")}>
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{t.nav.more}</h2>
                <button onClick={() => setSheet(false)} className="rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label={t.common.cancel}>
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {more.map((i) => (
                  <Link key={i.href} href={i.href} onClick={() => setSheet(false)}
                    className={cn("flex flex-col items-center gap-2 rounded-2xl border px-1 py-4 text-center text-sm",
                      isActive(pathname, i.href) ? "border-accent bg-sky" : "border-line hover:bg-surface-2")}>
                    <span className="grid size-11 place-items-center rounded-full bg-sky text-brand dark:text-accent"><NavIcon name={i.icon} className="size-5" /></span>
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
        className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-semibold text-white ring-1 ring-white/30">
        {initials}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 text-ink" role="dialog" aria-modal="true" aria-label={t.nav.profile}>
          <button className="absolute inset-0 bg-black/45" aria-label={t.common.cancel} onClick={() => setOpen(false)} />
          <div className={cn(FRAME, "absolute inset-x-0 bottom-0 rounded-t-3xl bg-surface px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]")}>
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
