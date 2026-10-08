"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, ChevronsLeft, ChevronsRight, Menu, Monitor, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/lib/i18n/client";
import type { NavItem } from "@/lib/nav";
import { NavIcon } from "./icon";
import { LanguageSwitch } from "./language-switch";
import { SignOutButton } from "./sign-out";
import { applyTheme, readSidebarCollapsed, readTheme, subscribePrefs, writeSidebarCollapsed, type Theme } from "@/lib/client-prefs";

export type ShellProps = {
  school: { name: string; place: string; logoUrl: string | null };
  user: { name: string; email: string; role: string };
  yearName: string | null;
  nav: NavItem[];
  bottom: NavItem[];
  unread: number;
  children: React.ReactNode;
};

function SchoolMark({ logoUrl, name, className }: { logoUrl: string | null; name: string; className?: string }) {
  return logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={logoUrl} alt="" className={cn("rounded-xl bg-white object-contain p-0.5", className)} />
    : <span aria-hidden className={cn("grid place-items-center rounded-xl bg-white/15 font-bold text-white", className)}>{name.slice(0, 1)}</span>;
}

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/portal" && pathname.startsWith(href + "/"));
}

export function AppShell({ school, user, yearName, nav, bottom, unread, children }: ShellProps) {
  const { t } = useT();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribePrefs, readSidebarCollapsed, () => false);
  const [drawer, setDrawer] = useState(false);
  const toggle = () => writeSidebarCollapsed(!collapsed);

  const links = (compact: boolean) => (
    <nav aria-label={t.nav.menu} className="flex flex-col gap-0.5 px-2">
      {nav.map((i) => {
        const active = isActive(pathname, i.href);
        return (
          <Link key={i.href} href={i.href} title={compact ? t.nav[i.key] : undefined} onClick={() => setDrawer(false)}
            aria-current={active ? "page" : undefined}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition",
              active ? "bg-white text-brand font-semibold" : "text-white/80 hover:bg-white/10 hover:text-white",
              compact && "justify-center px-0")}>
            <NavIcon name={i.icon} className="size-5 shrink-0" />
            {!compact && <span className="truncate">{t.nav[i.key]}</span>}
          </Link>
        );
      })}
    </nav>
  );

  const brandBlock = (compact: boolean) => (
    <div className={cn("flex items-center gap-3 px-4 pt-5 pb-4", compact && "justify-center px-2")}>
      <SchoolMark logoUrl={school.logoUrl} name={school.name} className="size-10 shrink-0" />
      {!compact && (
        <div className="min-w-0">
          <p className="font-semibold leading-tight text-white truncate">{school.name}</p>
          {school.place && <p className="text-xs text-white/65 truncate">{school.place}</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className={cn("no-print hidden lg:flex flex-col sticky top-0 h-dvh bg-brand transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-64")}>
        {brandBlock(collapsed)}
        <div className="stitch mx-4 mb-3 text-white/25" aria-hidden />
        <div className="flex-1 overflow-y-auto pb-4">{links(collapsed)}</div>
        <button onClick={toggle} className="m-3 flex items-center justify-center gap-2 rounded-xl py-2 text-white/70 hover:bg-white/10"
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}>
          {collapsed ? <ChevronsRight className="size-5" /> : <ChevronsLeft className="size-5" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-black/40" aria-label={t.common.cancel} onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-brand pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-start justify-between">
              {brandBlock(false)}
              <button onClick={() => setDrawer(false)} className="m-3 rounded-lg p-2 text-white/80" aria-label={t.common.cancel}>
                <X className="size-5" />
              </button>
            </div>
            <div className="stitch mx-4 mb-3 text-white/25" aria-hidden />
            <div className="flex-1 overflow-y-auto">{links(false)}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-5 pt-[env(safe-area-inset-top)]">
          <button className="rounded-xl p-2 text-ink-2 hover:bg-surface-2 lg:hidden" onClick={() => setDrawer(true)} aria-label={t.nav.menu}>
            <Menu className="size-6" />
          </button>
          <p className="truncate font-semibold lg:hidden">{school.name}</p>
          <div className="ml-auto flex items-center gap-2">
            {yearName && (
              <span className="hidden sm:inline rounded-full bg-sky px-3 py-1 text-sm text-ink-2">
                {t.common.academicYear}: <span className="num font-medium text-ink">{yearName}</span>
              </span>
            )}
            <LanguageSwitch className="hidden sm:inline-flex" />
            <Link href="/notifications" className="relative rounded-xl p-2 text-ink-2 hover:bg-surface-2" aria-label={t.common.notifications}>
              <Bell className="size-6" />
              {unread > 0 && (
                <span className="num absolute right-1 top-1 grid min-w-5 h-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
            <ProfileMenu user={user} />
          </div>
        </header>

        <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 pb-28 lg:pb-8">{children}</main>

        {/* Phone bottom navigation */}
        <nav aria-label={t.nav.menu}
          className="no-print fixed inset-x-0 bottom-0 z-40 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
          style={{ gridTemplateColumns: `repeat(${bottom.length + (bottom.length < 5 ? 1 : 0)}, minmax(0,1fr))` }}>
          {bottom.map((i) => {
            const active = isActive(pathname, i.href);
            return (
              <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-brand font-semibold" : "text-ink-2")}>
                <NavIcon name={i.icon} className="size-6" />{t.nav[i.key]}
              </Link>
            );
          })}
          {bottom.length < 5 && (
            <button onClick={() => setDrawer(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-ink-2">
              <Menu className="size-6" aria-hidden />{t.nav.more}
            </button>
          )}
        </nav>
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
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="grid size-10 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
        {initials}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-line bg-surface p-4 shadow-xl">
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-ink-2 truncate">{user.email}</p>
            <p className="mt-1 inline-block rounded-full bg-sky px-2.5 py-0.5 text-xs">{user.role}</p>
            <div className="mt-4 sm:hidden"><LanguageSwitch /></div>
            <p className="mt-4 mb-2 text-sm text-ink-2">{t.common.theme}</p>
            <div className="grid grid-cols-3 gap-1">
              {([["light", Sun, t.common.light], ["dark", Moon, t.common.dark], ["system", Monitor, t.common.system]] as const).map(([v, I, label]) => (
                <button key={v} onClick={() => applyTheme(v)} aria-pressed={theme === v}
                  className={cn("flex flex-col items-center gap-1 rounded-xl border py-2 text-xs",
                    theme === v ? "border-accent bg-sky text-ink" : "border-line text-ink-2")}>
                  <I className="size-4" aria-hidden />{label}
                </button>
              ))}
            </div>
            <SignOutButton label={t.common.signOut} className="mt-4 w-full" />
          </div>
        </>
      )}
    </div>
  );
}
