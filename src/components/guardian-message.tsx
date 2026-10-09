"use client";
import { useId, useState } from "react";
import { useLocale } from "@/lib/i18n/client";

export function GuardianMessage({ name, phone }: { name: string; phone: string }) {
  const locale = useLocale();
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  const id = useId();
  const [message, setMessage] = useState("");
  // Bangladesh local mobile numbers need a country code for WhatsApp.
  const digits = phone.replace(/[^0-9]/g, "");
  const number = /^01[3-9]\d{8}$/.test(digits) ? `88${digits}` : digits;
  const valid = (/^\+/.test(phone.trim()) && /^[1-9]\d{6,14}$/.test(number)) || /^8801[3-9]\d{8}$/.test(number);
  const ready = valid && message.trim().length > 0;
  const templates = [
    ["Attendance", "উপস্থিতি", `Dear ${name}, attendance update: [student], [date], [present/absent/late]. Please contact the school if needed.`],
    ["Homework", "বাড়ির কাজ", `Dear ${name}, homework for [student]: [subject and task]. Due: [date].`],
    ["Fees", "বেতন", `Dear ${name}, fee reminder for [student]: [amount] due on [date]. Please contact the school with any questions.`],
    ["Notice", "নোটিশ", `Dear ${name}, school notice: [announcement].`],
  ];
  const incomplete = /\[[^\]]+\]/.test(message);
  return <details className="mt-3 rounded-xl border border-line p-3">
    <summary className="cursor-pointer font-semibold">{L("Message guardian", "অভিভাবককে বার্তা")}</summary>
    <p className="my-2 text-sm text-ink-2">{L("Prepare a message, then send it in WhatsApp or your SMS app. Automatic notifications are not connected yet.", "বার্তা তৈরি করে WhatsApp অথবা SMS অ্যাপ থেকে পাঠান। স্বয়ংক্রিয় বার্তা এখনো সংযুক্ত নয়।")}</p>
    <div className="flex flex-wrap gap-2">{templates.map(([en, bn, text]) => <button key={en} type="button" className="min-h-11 rounded-lg bg-surface-2 px-3 text-sm" onClick={() => setMessage(text)}>{L(en, bn)}</button>)}</div>
    <label htmlFor={id} className="mt-3 block text-sm font-semibold">{L("Message", "বার্তা")}</label>
    <textarea id={id} value={message} onChange={e => setMessage(e.target.value)} rows={5} maxLength={2000} className="mt-1 w-full rounded-xl border border-line bg-surface p-3" />
    {!valid && <p className="mt-2 text-sm text-danger">{L("Save a guardian phone number with country code (for example +880…). Bangladesh mobile numbers starting 01 are also accepted.", "অভিভাবকের ফোন নম্বরে দেশের কোড দিন (যেমন +880…)। 01 দিয়ে শুরু বাংলাদেশি মোবাইল নম্বরও গ্রহণযোগ্য।")}</p>}
    {incomplete && <p className="mt-2 text-sm text-ink-2">{L("Replace all [placeholders] with the correct details before sending.", "পাঠানোর আগে [বন্ধনীর] সব তথ্য পূরণ করুন।")}</p>}
    <div className="mt-3 flex flex-wrap gap-3">{ready && !incomplete ? <>
      <a target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-surface-2 px-3 font-semibold" href={`https://wa.me/${number}?text=${encodeURIComponent(message.trim())}`}>WhatsApp</a>
      <a className="inline-flex min-h-11 items-center rounded-xl bg-surface-2 px-3 font-semibold" href={`sms:+${number}?body=${encodeURIComponent(message.trim())}`}>SMS</a>
    </> : <p className="text-sm text-ink-2">{L("Enter a valid phone number and complete message to open sending options.", "পাঠানোর অপশন পেতে সঠিক ফোন নম্বর ও সম্পূর্ণ বার্তা দিন।")}</p>}</div>
  </details>;
}
