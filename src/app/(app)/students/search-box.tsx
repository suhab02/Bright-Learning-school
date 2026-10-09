"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

/** Live search: updates ?q= as you type (debounced), keeping other filters. */
export function SearchBox({ placeholder, label }: { placeholder: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  const push = (v: string) => {
    const next = new URLSearchParams(params.toString());
    if (v.trim()) next.set("q", v.trim()); else next.delete("q");
    next.delete("page");
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  return (
    <div className="relative">
      <Search className={cn("pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-2/60", pending && "animate-pulse")} aria-hidden />
      <input type="search" value={value} aria-label={label} placeholder={placeholder} enterKeyHint="search"
        onChange={(e) => { setValue(e.target.value); clearTimeout(timer.current); timer.current = setTimeout(() => push(e.target.value), 300); }}
        onKeyDown={(e) => { if (e.key === "Enter") { clearTimeout(timer.current); push(value); } }}
        className="h-13 w-full rounded-2xl bg-surface pl-12 pr-11 text-[16px] card-shadow placeholder:text-ink-2/55 focus:outline-none focus:ring-4 focus:ring-accent/15 [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button type="button" aria-label="Clear" onClick={() => { setValue(""); push(""); }}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-surface-2 text-ink-2">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
