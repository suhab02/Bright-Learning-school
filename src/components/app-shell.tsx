"use client";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronRight, LayoutGrid, Monitor, Moon, ShieldCheck, Sun, X } from "lucide-react";
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

/** Compact modal and mobile navigation frame. Desktop content uses a full workspace. */
export const FRAME = "mx-auto w-full max-w-[480px]";

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/portal" && pathname.startsWith(href + "/"));
}

export function AppShell({ school, user, yearName, nav, bottom, unread, children }: ShellProps) {
  const { t, locale } = useT();
  const pathname = usePathname();
  const [sheet, setSheet] = useState(false);
  const inBottom = new Set(bottom.map((b) => b.href));
  const more = nav.filter((n) => !inBottom.has(n.href));
  const moreActive = more.some((m) => isActive(pathname, m.href));
  const current = nav.find((n) => isActive(pathname, n.href));

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#school-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:p-3">{locale === "bn" ? "মূল অংশে যান" : "Skip to content"}</a>
      <aside className="workspace-sidebar no-print fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col lg:flex">
        <Link href="/" className="flex items-center gap-3 px-6 pb-7 pt-8" aria-label={school.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={school.logoUrl} alt="" className="size-11 shrink-0 rounded-xl bg-white object-contain p-1" />
          <span className="min-w-0"><span className="block text-sm font-semibold leading-snug">{school.name}</span><span className="mt-1 block text-[11px] text-white/55">{yearName ? `${t.common.academicYear} ${yearName}` : school.place}</span></span>
        </Link>
        <p className="mb-3 px-7 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{locale === "bn" ? "স্কুল পরিচালনা" : "School workspace"}</p>
        <nav aria-label={t.nav.menu} className="flex-1 space-y-1 overflow-y-auto px-4 pb-5">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-colors", active ? "bg-white/12 text-white ring-1 ring-white/10" : "text-white/65 hover:bg-white/6 hover:text-white")}><NavIcon name={item.icon} className="size-[18px]" /><span>{t.nav[item.key]}</span>{active && <span className="ml-auto size-1.5 rounded-full bg-gold" />}</Link>;
          })}
        </nav>
        <div className="mx-5 mb-6 border-t border-white/10 pt-5"><p className="text-sm font-medium">{user.name}</p><p className="mt-1 flex items-center gap-1.5 text-xs text-white/55"><ShieldCheck className="size-3.5" />{user.role}</p></div>
      </aside>
      <div className="relative flex min-h-dvh flex-col lg:ml-[252px]">
        {/* Top app bar */}
        <header className="workspace-header no-print sticky top-0 z-30 border-b border-line pt-[env(safe-area-inset-top)]">
          <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-2 px-4 sm:gap-3 lg:h-[76px] lg:px-10">
            <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5 lg:hidden" aria-label={school.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={school.logoUrl} alt="" className="size-10 shrink-0 rounded-xl border border-line bg-white object-contain p-1" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">{school.name}</span>
                <span className="mt-1 block truncate text-[11px] text-ink-2">
                  {yearName ? `${t.common.academicYear} ${yearName}` : school.place}
                </span>
              </span>
            </Link>
            <div className="hidden min-w-0 flex-1 items-center gap-2 text-xs text-ink-2 lg:flex"><span>{locale === "bn" ? "স্কুল" : "Workspace"}</span><ChevronRight className="size-3" /><span className="font-medium text-ink">{current ? t.nav[current.key] : school.name}</span></div>
            <Link href="/notifications" className="press relative grid size-10 place-items-center rounded-xl border border-line bg-surface hover:bg-surface-2" aria-label={t.common.notifications}>
              <Bell className="size-[19px]" />
              {unread > 0 && (
                <span className="num absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-sun px-1 text-[11px] font-bold text-white ring-2 ring-brand-deep">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <ProfileMenu user={user} />
          </div>
        </header>

        <main id="school-content" className="mx-auto w-full min-w-0 max-w-[1280px] flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4 sm:px-7 lg:px-10 lg:pb-10 lg:pt-7"><div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs lg:mb-6"><span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 font-medium text-ink-2"><ShieldCheck className="size-3.5 text-brand" />{user.role}</span><Link href="/help" className="inline-flex min-h-11 items-center gap-1.5 font-medium text-ink-2 hover:text-brand">{locale === "bn" ? "আপনার অনুমতি ও সহায়তা" : "Your access & help"}<ChevronRight className="size-3.5" /></Link></div>{children}</main>

        {/* Floating bottom tab bar */}
        <div className="no-print fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[640px] px-3 pb-[calc(10px+env(safe-area-inset-bottom))] lg:hidden">
          <nav aria-label={t.nav.menu}
            className="float-shadow grid rounded-[20px] bg-surface/95 p-1.5 backdrop-blur-xl ring-1 ring-line"
            style={{ gridTemplateColumns: `repeat(${bottom.length + (more.length ? 1 : 0)}, minmax(0,1fr))` }}>
            {bottom.map((i) => {
              const active = isActive(pathname, i.href);
              return (
                <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                  className={cn("press flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px] py-2 text-[11px] font-semibold transition-colors",
                    active ? "bg-sky text-brand" : "text-ink-2 hover:text-ink")}>
                  <NavIcon name={i.icon} className="size-[22px]" />
                  <span className="max-w-full truncate px-1">{t.nav[i.key]}</span>
                </Link>
              );
            })}
            {more.length > 0 && (
              <button onClick={() => setSheet(true)} aria-expanded={sheet} aria-haspopup="dialog"
                className={cn("press flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px] py-2 text-[11px] font-semibold",
                  moreActive ? "bg-sky text-brand" : "text-ink-2 hover:text-ink")}>
                <LayoutGrid className="size-[22px]" aria-hidden />
                {t.nav.more}
              </button>
            )}
          </nav>
        </div>

        {/* "More" sheet: every other section as a big-tap grid */}
        {sheet && (
          <MenuSheet title={t.nav.more} onClose={() => setSheet(false)}>
              <div className="grid grid-cols-2 gap-3 min-[380px]:grid-cols-3">
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
          </MenuSheet>
        )}
      </div>
    </div>
  );
}

/** Native modal top layer keeps header menus above the fixed bottom navigation. */
function MenuSheet({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useT();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 text-ink backdrop:bg-black/45"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={cn(FRAME, "rise absolute inset-x-0 bottom-0 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-t-[32px] bg-surface px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))]")}>
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-11 place-items-center rounded-full text-ink-2 hover:bg-surface-2" aria-label={t.common.cancel}>
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
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
        className="press grid size-10 shrink-0 place-items-center rounded-full border border-line bg-sky text-xs font-semibold text-brand">
        {initials}
      </button>
      {open && (
        <MenuSheet title={t.nav.profile} onClose={() => setOpen(false)}>
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
        </MenuSheet>
      )}
    </>
  );
}
