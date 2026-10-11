"use client";
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellRing, BookOpen, CalendarCheck, Check, CheckCheck, ChevronRight, FileText, Inbox, Wallet } from "lucide-react";
import { markNotificationsRead } from "@/lib/workflows/notifications";
import { Button, Notice } from "./ui";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

export type NotificationRow = {id:string;kind:string;title:string;body:string|null;link:string|null;read_at:string|null;created_at:string};
export function NotificationCentre({rows,locale,today}:{rows:NotificationRow[];locale:"bn"|"en";today:string}) {
  const L=(en:string,bn:string)=>locale === "bn" ? bn : en;
  const [filter,setFilter]=useState("all"); const [expanded,setExpanded]=useState<string|null>(null);
  const [pending,startTransition]=useTransition(); const [error,setError]=useState(false);
  const [items,optimisticRead]=useOptimistic(rows,(current,id:string|null)=>current.map(n=>!id || n.id === id ? {...n,read_at:n.read_at || "read"} : n));
  const unread=items.filter(n=>!n.read_at).length;
  const filtered=items.filter(n=>filter !== "unread" || !n.read_at);
  const read=(id?:string)=>startTransition(async()=>{setError(false);optimisticRead(id || null);const result=await markNotificationsRead(id);if(!result.ok)setError(true);});
  const badge=(kind:string)=>{
    if(/payment|fee/.test(kind))return {Icon:Wallet,label:L("Fees & payments","ফি ও পেমেন্ট"),tint:"bg-emerald-50 text-emerald-700"};
    if(/attendance|absence/.test(kind))return {Icon:CalendarCheck,label:L("Attendance","হাজিরা"),tint:"bg-sky text-blue-700"};
    if(/homework/.test(kind))return {Icon:BookOpen,label:L("Homework","বাড়ির কাজ"),tint:"bg-orange-50 text-orange-700"};
    if(/notice/.test(kind))return {Icon:FileText,label:L("School update","স্কুলের খবর"),tint:"bg-violet-50 text-violet-700"};
    return {Icon:Bell,label:L("Update","বিজ্ঞপ্তি"),tint:"bg-sky text-brand"};
  };
  const groups=[{label:L("Today","আজ"),rows:filtered.filter(n=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(n.created_at)) === today)},{label:L("Earlier","আগের বিজ্ঞপ্তি"),rows:filtered.filter(n=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(n.created_at)) !== today)}];
  return <div className="space-y-5">
    <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#4941c8] to-[#7162dc] p-6 text-white">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium tracking-wider text-white/75">{L("YOUR SCHOOL UPDATES","আপনার স্কুলের খবর")}</p><h1 className="mt-2 text-3xl font-bold">{L("Notifications","বিজ্ঞপ্তি")}</h1></div><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15"><BellRing className="size-6" aria-hidden /></span></div>
      <p className="mt-3 text-sm leading-relaxed text-white/85">{L("Attendance, class updates and important reminders—all in one place.","হাজিরা, শ্রেণির খবর ও জরুরি বার্তা—সব এক জায়গায়।")}</p>
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm"><span className={cn("size-2 rounded-full",unread ? "bg-amber-300" : "bg-emerald-300")} /><span>{unread ? `${locale === "bn" ? unread.toLocaleString("bn-BD") : unread} ${L("unread updates","অপঠিত বিজ্ঞপ্তি")}` : L("You're all caught up","সব বিজ্ঞপ্তি পড়া হয়েছে")}</span></div>
    </section>
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line" role="group" aria-label={L("Notification filter","বিজ্ঞপ্তি বাছাই")}>{[{key:"all",label:L("All","সব")},{key:"unread",label:L("Unread","অপঠিত")}].map(f=><button key={f.key} type="button" aria-pressed={filter === f.key} onClick={()=>setFilter(f.key)} className={cn("min-h-11 rounded-xl px-4 text-sm font-semibold",filter === f.key ? "bg-sky text-brand" : "text-ink-2")}>{f.label}</button>)}</div>{unread>0 && <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={()=>read()}><CheckCheck className="size-4" />{L("Read all","সব পড়া হয়েছে")}</Button>}</div>
    {error && <Notice tone="error">{L("Could not update notifications. Please try again.","বিজ্ঞপ্তি আপডেট করা যায়নি। আবার চেষ্টা করুন।")}</Notice>}
    {!filtered.length && <div className="rounded-[26px] border border-line bg-surface px-6 py-10 text-center"><span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-sky text-brand"><Inbox className="size-8" aria-hidden /></span><h2 className="mt-4 text-lg font-bold">{filter === "unread" ? L("Nothing unread","কোনো অপঠিত বিজ্ঞপ্তি নেই") : L("Your updates will appear here","আপনার বিজ্ঞপ্তি এখানে দেখা যাবে")}</h2><p className="mt-2 text-sm leading-relaxed text-ink-2">{L("When the school shares an update with you, you'll find its details here.","স্কুল আপনার জন্য কোনো খবর পাঠালে তার বিস্তারিত এখানে পাবেন।")}</p><Link href="/notices" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky px-4 text-sm font-semibold text-brand">{L("School notices","স্কুলের নোটিশ")}<ChevronRight className="size-4" /></Link></div>}
    {groups.filter(g=>g.rows.length).map(group=><section key={group.label}><h2 className="mb-3 px-1 text-sm font-semibold text-ink-2">{group.label}</h2><ul className="space-y-3">{group.rows.map(n=>{const {Icon,label,tint}=badge(n.kind);const open=expanded === n.id;const safeLink=n.link?.startsWith("/") && !n.link.startsWith("//") ? n.link : null;return <li key={n.id} className={cn("overflow-hidden rounded-[24px] border bg-surface",!n.read_at ? "border-violet-200 shadow-sm" : "border-line")}>
      <button type="button" aria-expanded={open} aria-controls={`notification-${n.id}`} className="flex w-full items-start gap-3 p-4 text-left" onClick={()=>setExpanded(open ? null : n.id)}><span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl",tint)}><Icon className="size-5" aria-hidden /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold text-ink-2">{label}</span>{!n.read_at && <span className="size-2 shrink-0 rounded-full bg-violet-500" aria-label={L("Unread","অপঠিত")} />}</span><span className="mt-1 block break-words text-base font-semibold leading-snug">{n.title}</span>{n.body && !open && <span className="mt-1 block line-clamp-2 break-words text-sm text-ink-2">{n.body}</span>}<span className="mt-2 block text-[11px] text-ink-2">{formatDate(n.created_at,locale)}</span></span><ChevronRight className={cn("mt-4 size-4 shrink-0 text-ink-2",open && "rotate-90")} aria-hidden /></button>
      <div id={`notification-${n.id}`} hidden={!open} className="border-t border-line px-4 pb-4 pt-3">{n.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{n.body}</p>}<div className="mt-3 flex flex-wrap items-center gap-2">{safeLink && <Link className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-sky px-3 text-sm font-semibold text-brand" href={safeLink}>{L("Open details","বিস্তারিত খুলুন")}<ChevronRight className="size-4" /></Link>}{!n.read_at && <Button variant="ghost" size="sm" disabled={pending} onClick={()=>read(n.id)}><Check className="size-4" />{L("Mark read","পড়া হয়েছে")}</Button>}</div></div>
    </li>;})}</ul></section>)}
  </div>;
}
