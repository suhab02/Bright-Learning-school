import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "paid";
const btn: Record<BtnVariant, string> = {
  primary: "bg-brand text-white hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-110",
  paid: "bg-paid text-white hover:brightness-105",
};

export const Button = forwardRef<HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md" | "lg" }>(
  function Button({ className, variant = "primary", size = "md", ...p }, ref) {
    return (
      <button ref={ref} {...p}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none select-none",
          size === "sm" && "h-9 px-3 text-sm",
          size === "md" && "h-11 px-4",
          size === "lg" && "h-12 px-5 text-base",
          btn[variant], className)} />
    );
  });

const field = "w-full rounded-xl border border-line bg-surface px-3.5 text-ink placeholder:text-ink-2/60 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 disabled:opacity-60";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) {
    return <input ref={ref} {...p} className={cn(field, "h-11", className)} />;
  });
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...p }, ref) {
    return <textarea ref={ref} {...p} className={cn(field, "py-2.5 min-h-24", className)} />;
  });
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...p }, ref) {
    return <select ref={ref} {...p} className={cn(field, "h-11 pr-8", className)} />;
  });

export function Field({ label, hint, error, children, className, htmlFor }: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string; htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">{label}</label>
      {children}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p>
        : hint ? <p className="text-xs text-ink-2">{hint}</p> : null}
    </div>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-2xl bg-surface border border-line", className)} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-xl bg-line/60", className)} />;
}

export function Notice({ tone = "info", children, className }: {
  tone?: "info" | "success" | "warn" | "error"; children: React.ReactNode; className?: string;
}) {
  const tones = {
    info: "bg-sky text-ink border-accent/30",
    success: "bg-paid/10 text-ink border-paid/40",
    warn: "bg-due/15 text-ink border-due/50",
    error: "bg-danger/10 text-ink border-danger/40",
  };
  return <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>{children}</div>;
}
