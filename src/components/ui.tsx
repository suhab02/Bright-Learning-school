import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "paid" | "light";
const btn: Record<BtnVariant, string> = {
  primary: "bg-brand text-white shadow-[0_8px_20px_-10px_var(--brand)] hover:brightness-110",
  secondary: "bg-surface text-ink card-shadow hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
  paid: "bg-paid text-white shadow-[0_8px_20px_-10px_var(--paid)] hover:brightness-105",
  light: "bg-white/15 text-white ring-1 ring-white/25 hover:bg-white/25",
};

export const Button = forwardRef<HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" }>(
  function Button({ className, variant = "primary", size = "md", ...p }, ref) {
    return (
      <button ref={ref} {...p}
        className={cn(
          "press inline-flex items-center justify-center gap-2 rounded-2xl font-semibold disabled:opacity-50 disabled:pointer-events-none select-none",
          size === "sm" && "h-9 px-3.5 text-sm rounded-xl",
          size === "md" && "h-12 px-5",
          size === "lg" && "h-14 px-6 text-[17px]",
          btn[variant], className)} />
    );
  });

const field = "w-full rounded-2xl border border-transparent bg-surface-2 px-4 text-[16px] text-ink placeholder:text-ink-2/55 transition focus:border-accent focus:bg-surface focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:opacity-60 aria-invalid:border-danger aria-invalid:ring-danger/15";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) {
    return <input ref={ref} {...p} className={cn(field, "h-13", className)} />;
  });
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...p }, ref) {
    return <textarea ref={ref} {...p} className={cn(field, "py-3 min-h-24", className)} />;
  });
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...p }, ref) {
    return (
      <span className="relative block">
        <select ref={ref} {...p} className={cn(field, "h-13 appearance-none pr-11", className)} />
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-ink-2" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </span>
    );
  });

export function Field({ label, hint, error, children, className, htmlFor }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="px-1 text-[13px] font-semibold text-ink-2">{label}</label>
      {children}
      {error ? <p role="alert" className="px-1 text-sm font-medium text-danger">{error}</p>
        : hint ? <p className="px-1 text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-[22px] bg-surface card-shadow", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-[22px] bg-line/70", className)} />;
}

export function Notice({ tone = "info", children, className }: {
  tone?: "info" | "success" | "warn" | "error"; children: React.ReactNode; className?: string;
}) {
  const tones = {
    info: "tint-blue",
    success: "tint-green",
    warn: "tint-amber",
    error: "tint-rose",
  };
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-2xl px-4 py-3 text-sm font-medium", tones[tone], className)}>{children}</div>;
}
