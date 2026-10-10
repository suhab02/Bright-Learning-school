import Link from "next/link";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type Tint = "blue" | "green" | "orange" | "violet" | "rose" | "teal" | "amber" | "slate";
const TINTS: Tint[] = ["blue", "green", "orange", "violet", "teal", "rose", "amber"];

/** Stable colour per person, so the same student always gets the same avatar colour. */
export function tintFor(key: string): Tint {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  // Bangla: one whole letter (grapheme cluster), e.g. "আ" from "আয়েশা"
  if (/[ঀ-৿]/.test(parts[0])) {
    const first = new Intl.Segmenter("bn", { granularity: "grapheme" }).segment(parts[0])[Symbol.iterator]().next().value;
    return first?.segment ?? parts[0][0];
  }
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Avatar({ name, id, size = 44, className, src }: { name: string; id: string; size?: number; className?: string; src?: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" aria-hidden width={size} height={size} loading="lazy"
        className={cn("shrink-0 rounded-2xl bg-surface-2 object-cover", className)} style={{ width: size, height: size }} />
    );
  }
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-2xl font-bold", `tint-${tintFor(id)}`, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
    </span>
  );
}

export function IconChip({ icon: Icon, tint, size = 44, className }: { icon: LucideIcon; tint: Tint; size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-2xl", `tint-${tint}`, className)} style={{ width: size, height: size }}>
      <Icon style={{ width: size * 0.48, height: size * 0.48 }} strokeWidth={2.2} />
    </span>
  );
}

export function Chip({ children, tint = "slate", className }: { children: React.ReactNode; tint?: Tint; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", `tint-${tint}`, className)}>{children}</span>;
}

/** Large app-style title. `back` shows a round back button. */
export function PageHeader({ title, subtitle, back, action }: {
  title: string; subtitle?: string; back?: string; action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      {back && (
        <Link href={back} aria-label="Back" className="press grid size-11 shrink-0 place-items-center rounded-2xl bg-surface card-shadow">
          <ChevronLeft className="size-5" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.035em]">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Brand gradient band that continues the top bar (place first on a page). */
export function HeroBand({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("workspace-hero relative mb-6 overflow-hidden rounded-[24px] p-5", className)}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 mt-8 flex items-center justify-between gap-3">
      <h2 className="text-[16px] font-semibold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

/** Tappable row used in every list. */
export function ListRow({ href, leading, title, subtitle, trailing, className }: {
  href?: string; leading?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode;
  trailing?: React.ReactNode; className?: string;
}) {
  const inner = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[13px] text-ink-2">{subtitle}</span>}
      </span>
      {trailing}
      {href && <ChevronRight className="size-5 shrink-0 text-ink-2/50" aria-hidden />}
    </>
  );
  const cls = cn("flex items-center gap-3 px-4 py-3", href && "press hover:bg-surface-2", className);
  return href ? <Link href={href} className={cls}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

export function EmptyState({ icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <IconChip icon={icon} tint="blue" size={64} className="rounded-3xl" />
      <p className="mt-4 font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-xs text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Square action tile with a coloured icon. */
export function Tile({ href, icon, tint, label }: { href: string; icon: LucideIcon; tint: Tint; label: string }) {
  return (
    <Link href={href} className="school-shortcut press flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-2 py-5 text-center hover:border-accent/30">
      <IconChip icon={icon} tint={tint} size={38} className="rounded-xl" />
      <span className="text-xs font-medium leading-snug">{label}</span>
    </Link>
  );
}
