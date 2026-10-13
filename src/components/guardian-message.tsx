"use client";
import { useId, useRef, useState, useTransition } from "react";
import { ChevronDown, MessageCircle, Send } from "lucide-react";
import { useLocale } from "@/lib/i18n/client";
import { bangladeshMobile, smsSegments } from "@/lib/sms";
import { sendGuardianSms, type SmsResult } from "@/lib/send-guardian-sms";

export function GuardianMessage({ name, phone, guardianId, schoolSms }: { name: string; phone: string; guardianId?: string; schoolSms?: { allowed: boolean; configured: boolean } }) {
  const locale = useLocale();
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  const id = useId();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [smsResult, setSmsResult] = useState<SmsResult | null>(null);
  const requestId = useRef<string | null>(null);
  const editMessage = (value: string) => { setMessage(value); setSmsResult(null); requestId.current = null; };
  // Bangladesh local mobile numbers need a country code for WhatsApp.
  const digits = phone.replace(/[০-৯]/g,d=>String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/[^0-9]/g, "");
  const number = /^01[3-9]\d{8}$/.test(digits) ? `88${digits}` : digits;
  const valid = (/^\+/.test(phone.trim()) && /^[1-9]\d{6,14}$/.test(number)) || /^8801[3-9]\d{8}$/.test(number);
  const ready = valid && message.trim().length > 0;
  const templates = [
    ["Attendance", "উপস্থিতি", L(`Dear ${name}, attendance update: [student], [date], [present/absent/late]. Please contact the school if needed.`, `সম্মানিত ${name}, [শিক্ষার্থীর নাম]-এর [তারিখ]-এর হাজিরা: [উপস্থিত/অনুপস্থিত/দেরি]। প্রয়োজনে স্কুলে যোগাযোগ করুন।`)],
    ["Homework", "বাড়ির কাজ", L(`Dear ${name}, homework for [student]: [subject and task]. Due: [date].`, `সম্মানিত ${name}, [শিক্ষার্থীর নাম]-এর বাড়ির কাজ: [বিষয় ও কাজ]। জমা দেওয়ার তারিখ: [তারিখ]।`)],
    ["Fees", "বেতন", L(`Dear ${name}, fee reminder for [student]: [amount] due on [date]. Please contact the school with any questions.`, `সম্মানিত ${name}, [শিক্ষার্থীর নাম]-এর ফি [টাকার পরিমাণ] টাকা। পরিশোধের তারিখ: [তারিখ]। বিস্তারিত জানতে স্কুলে যোগাযোগ করুন।`)],
    ["Notice", "নোটিশ", L(`Dear ${name}, school notice: [announcement].`, `সম্মানিত ${name}, স্কুলের নোটিশ: [বিজ্ঞপ্তির বিবরণ]।`)],
  ];
  const incomplete = /\[[^\]]+\]/.test(message);
  return <details className="group mt-3 rounded-2xl border border-line bg-surface p-4">
    <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold"><MessageCircle aria-hidden className="size-5 shrink-0 text-brand" /><span className="flex-1">{L("Message guardian", "অভিভাবককে বার্তা")}</span><ChevronDown aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-180" /></summary>
    <p className="mb-3 break-words rounded-xl bg-surface-2 px-3 py-2 text-sm"><span className="block font-semibold">{name}</span><span className="text-ink-2">{phone}</span></p>
    <p className="my-2 text-sm text-ink-2">{L("Prepare a message, then send it in WhatsApp or your SMS app. Automatic notifications are not connected yet.", "বার্তা তৈরি করে WhatsApp অথবা SMS অ্যাপ থেকে পাঠান। স্বয়ংক্রিয় বার্তা এখনো সংযুক্ত নয়।")}</p>
    <div className="flex flex-wrap gap-2">{templates.map(([en, bn, text]) => <button key={en} type="button" disabled={pending} className="min-h-11 rounded-lg bg-surface-2 px-3 text-sm" onClick={() => editMessage(text)}>{L(en, bn)}</button>)}</div>
    <label htmlFor={id} className="mt-3 block text-sm font-semibold">{L("Message", "বার্তা")}</label>
    <textarea id={id} value={message} disabled={pending} onChange={e => editMessage(e.target.value)} rows={5} maxLength={2000} placeholder={L("Write an update for the guardian…", "অভিভাবকের জন্য বার্তা লিখুন…")} className="mt-1 w-full rounded-xl border border-line bg-surface p-3 text-base" />
    {!valid && <p className="mt-2 text-sm text-danger">{L("Save a guardian phone number with country code (for example +880…). Bangladesh mobile numbers starting 01 are also accepted.", "অভিভাবকের ফোন নম্বরে দেশের কোড দিন (যেমন +880…)। 01 দিয়ে শুরু বাংলাদেশি মোবাইল নম্বরও গ্রহণযোগ্য।")}</p>}
    {incomplete && <p className="mt-2 text-sm text-ink-2">{L("Replace all [placeholders] with the correct details before sending.", "পাঠানোর আগে [বন্ধনীর] সব তথ্য পূরণ করুন।")}</p>}
    <div className="mt-4 grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">{ready && !incomplete ? <>
      <a target="_blank" rel="noopener noreferrer" className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-3 font-semibold text-white" href={`https://wa.me/${number}?text=${encodeURIComponent(message.trim())}`}><MessageCircle aria-hidden className="size-5" />WhatsApp</a>
      <a className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-3 font-semibold" href={`sms:+${number}?body=${encodeURIComponent(message.trim())}`}><Send aria-hidden className="size-4" />SMS</a>
    </> : <p className="text-sm text-ink-2">{L("Enter a valid phone number and complete message to open sending options.", "পাঠানোর অপশন পেতে সঠিক ফোন নম্বর ও সম্পূর্ণ বার্তা দিন।")}</p>}</div>
    {schoolSms?.allowed && guardianId && <div className="mt-4 space-y-2 border-t border-line pt-4">
      <p className="text-xs leading-relaxed text-ink-2">{L("School SIM SMS uses your mobile operator's SMS charges or pack. Bangladesh numbers only; maximum 210 characters.", "স্কুলের সিম থেকে SMS পাঠালে অপারেটরের চার্জ বা SMS প্যাক প্রযোজ্য। শুধু বাংলাদেশি নম্বর; সর্বোচ্চ ২১০ অক্ষর।")}{message.trim() && ` ${smsSegments(message.trim())} SMS ${L("segment(s)", "অংশ")}.`}</p>
      {!schoolSms.configured && <p className="text-sm text-ink-2">{L("TextBee is not configured. The Super Admin can open Settings → Guardian SMS setup.", "TextBee সংযুক্ত নয়। সুপার অ্যাডমিন Settings → অভিভাবক SMS সেটআপ খুলতে পারবেন।")}</p>}
      <button type="button" className="press min-h-12 w-full rounded-xl bg-brand px-3 font-semibold text-white disabled:opacity-40" disabled={pending || !schoolSms.configured || !bangladeshMobile(phone) || !ready || incomplete || message.trim().length > 210 || smsResult?.status === "queued" || smsResult?.status === "unknown"} onClick={() => {
        requestId.current ??= crypto.randomUUID();
        const attemptId=requestId.current;
        startTransition(async () => {
          try { const result=await sendGuardianSms({guardianId,message:message.trim(),requestId:attemptId});setSmsResult(result);if(result.status==='failed')requestId.current=null; }
          catch { setSmsResult({status:'unknown',message:L('Could not confirm this attempt. Check TextBee before sending again.','এই SMS-এর অবস্থা নিশ্চিত করা যায়নি। আবার পাঠানোর আগে TextBee দেখুন।')}); }
        });
      }}>{pending ? L("Submitting…", "পাঠানো হচ্ছে…") : L("Send via school SIM", "স্কুলের সিম থেকে SMS পাঠান")}</button>
      {smsResult && <p role="status" className="text-sm leading-relaxed text-ink-2">{smsResult.status==='queued'?L('Queued to the school phone. Delivery is not confirmed.','স্কুলের ফোনে পাঠানোর জন্য জমা হয়েছে। ডেলিভারি এখনো নিশ্চিত নয়।'):smsResult.message}</p>}
    </div>}
  </details>;
}
