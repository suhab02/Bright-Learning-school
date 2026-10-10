"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Search, Users } from "lucide-react";
import { Avatar, Chip, EmptyState } from "./page";
import { cn } from "@/lib/cn";

type Teacher = {
  id: string; name: string; code: string; designation: string; status: string;
  photo: string | null; assignments: string[];
};

export function TeacherDirectory({ teachers, locale }: { teachers: Teacher[]; locale: "en" | "bn" }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  const statusLabel = (value: string) => ({
    active: L("Active", "সক্রিয়"), on_leave: L("On leave", "ছুটিতে"), resigned: L("Archived", "আর্কাইভ"),
  }[value] ?? value);
  const filtered = teachers.filter((teacher) => (status === "all" || teacher.status === status) &&
    [teacher.name, teacher.code, teacher.designation, ...teacher.assignments].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div>
    <div className="mb-5 rounded-[26px] bg-sky p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand">{L("Our teaching team", "আমাদের শিক্ষক দল")}</p>
      <p className="mt-2 text-2xl font-semibold">{L("People behind the learning", "শেখার পেছনের মানুষগুলো")}</p>
      <p className="mt-2 text-sm text-ink-2">{L("Browse profiles, classes and subjects. Tap a card to see the full profile.", "প্রোফাইল, শ্রেণি ও বিষয় দেখুন। বিস্তারিত দেখতে কার্ডে চাপুন।")}</p>
    </div>
    <label className="relative block">
      <Search aria-hidden className="absolute left-4 top-4 size-5 text-ink-2" />
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        aria-label={L("Search teachers", "শিক্ষক খুঁজুন")} placeholder={L("Name, class or subject…", "নাম, শ্রেণি বা বিষয়…")}
        className="h-13 w-full rounded-2xl border border-line bg-surface pl-12 pr-4 text-base" />
    </label>
    <div className="my-4 flex gap-2 overflow-x-auto pb-1" aria-label={L("Teacher status", "শিক্ষকের অবস্থা")}>
      {["all", "active", "on_leave", "resigned"].map((value) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}
        className={cn("min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold", status === value ? "bg-brand text-white" : "bg-surface text-ink-2")}>
        {value === "all" ? L("All", "সকল") : statusLabel(value)}
      </button>)}
    </div>
    <p className="mb-3 text-xs text-ink-2" aria-live="polite">{new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en").format(filtered.length)} {L("profiles", "প্রোফাইল")}</p>
    {filtered.length ? <ul className="space-y-3">
      {filtered.map((teacher) => <li key={teacher.id}>
        <Link href={`/teachers/${teacher.id}`} className="press block rounded-[26px] border border-line bg-surface p-5 card-shadow">
          <div className="flex items-start gap-4">
            <Avatar name={teacher.name} id={teacher.id} src={teacher.photo} size={64} className="rounded-[22px]" />
            <div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{teacher.name}</h2>
              <p className="mt-1 text-sm text-ink-2">{teacher.designation || L("Teaching staff", "শিক্ষক")}</p>
              <p className="mt-1 text-xs text-ink-2">{teacher.code}</p>
            </div>
            <ArrowUpRight aria-hidden className="size-5 shrink-0 text-brand" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3"><Chip tint={teacher.status === "active" ? "green" : "slate"}>{statusLabel(teacher.status)}</Chip>
            <span className="text-xs font-semibold text-brand">{L("View profile", "প্রোফাইল দেখুন")}</span>
          </div>
          <div className="mt-4 flex gap-2 border-t border-line pt-3 text-xs text-ink-2"><BookOpen aria-hidden className="size-4 shrink-0" />
            <span>{[...new Set(teacher.assignments)].join(" · ") || L("No class assigned yet", "এখনও শ্রেণির দায়িত্ব দেওয়া হয়নি")}</span>
          </div>
        </Link>
      </li>)}
    </ul> : <EmptyState icon={Users} title={L("No matching profiles", "কোনো প্রোফাইল পাওয়া যায়নি")} body={L("Try another search or status. Add your first teacher below.", "অন্য নাম বা অবস্থা দিয়ে খুঁজুন। নিচে নতুন শিক্ষক যোগ করুন।")} />}
  </div>;
}
