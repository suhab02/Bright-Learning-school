"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/cn";
import { useLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n";
import { setDocumentLang, writeCookie } from "@/lib/client-prefs";

/** বাংলা | English — sets a cookie and re-renders on the server. Form state on the page is kept. */
export function LanguageSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (l: Locale) => {
    if (l === locale) return;
    writeCookie("bls_locale", l);
    setDocumentLang(l);
    start(() => router.refresh());
  };
  return (
    <div role="group" aria-label="Language / ভাষা"
      className={cn("inline-flex rounded-full border border-line bg-surface p-0.5 text-sm", pending && "opacity-60", className)}>
      {(["bn", "en"] as const).map((l) => (
        <button key={l} type="button" onClick={() => set(l)} aria-pressed={locale === l}
          className={cn("rounded-full px-3 py-1 transition", locale === l ? "bg-brand text-white" : "text-ink-2 hover:text-ink")}>
          {l === "bn" ? "বাংলা" : "English"}
        </button>
      ))}
    </div>
  );
}
