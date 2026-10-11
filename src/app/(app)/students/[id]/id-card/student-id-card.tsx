"use client";

import { useState } from "react";
import { CheckCircle2, ImageOff, Printer, ShieldCheck } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { initials } from "@/components/page";
import "./student-id-card.css";

type CardData = {
  name: string; school: string; logo: string; code: string; classLabel: string;
  roll: string; photo: string | null; year: string; status: string; active: boolean;
  phone: string | null; address: string;
};

export function StudentIdCard({ data, locale }: { data: CardData; locale: "bn" | "en" }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  return <div>
    <div className="no-print mb-5 rounded-[24px] bg-sky p-4">
      <p className="flex items-center gap-2 font-semibold text-brand"><ShieldCheck className="size-5" />{L("Your school. Their identity.", "আপনার স্কুল। তাদের পরিচয়।")}</p>
      <p className="mt-2 text-sm text-ink-2">{L("Created from the student profile. Update their photo and class there to refresh this card.", "শিক্ষার্থীর প্রোফাইল থেকে তৈরি। কার্ড বদলাতে প্রোফাইলে ছবি ও শ্রেণি আপডেট করুন।")}</p>
    </div>
    {!data.active && <div className="no-print mb-4"><Notice tone="warn">{L("This student is not active. Their current status is shown on the card.", "এই শিক্ষার্থী সক্রিয় নয়। কার্ডে বর্তমান অবস্থা দেখানো হয়েছে।")} {data.status}</Notice></div>}
    {(!data.photo || photoFailed) && <div className="no-print mb-4"><Notice tone="warn"><span className="flex items-center gap-2"><ImageOff className="size-4" />{L("Add a student photo before printing the final card.", "চূড়ান্ত কার্ড প্রিন্ট করার আগে শিক্ষার্থীর ছবি যোগ করুন।")}</span></Notice></div>}
    <div className="student-card-sheet">
      <section aria-label={L("ID card front", "আইডি কার্ডের সামনের অংশ")} className="student-card-card">
        <div className="student-card-front">
          <header className="student-card-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.logo} alt="" className="student-card-logo" />
            <div><p className="student-card-school">{data.school}</p><p className="student-card-caption">{L("STUDENT IDENTITY CARD", "শিক্ষার্থী পরিচয়পত্র")}</p></div>
          </header>
          <div className="student-card-details">
            <div className="student-card-portrait">
              {data.photo && !photoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.photo} alt={data.name} onError={() => setPhotoFailed(true)} />
              ) : <span>{initials(data.name)}</span>}
            </div>
            <div className="student-card-identity">
              <h2 className="student-card-name">{data.name}</h2>
              <dl className="student-card-fields">
                <div><dt>{L("Student ID", "আইডি")}</dt><dd>{data.code}</dd></div>
                <div><dt>{L("Class", "শ্রেণি")}</dt><dd>{data.classLabel}</dd></div>
                <div><dt>{L("Roll", "রোল")}</dt><dd>{data.roll}</dd></div>
              </dl>
            </div>
          </div>
          <footer className="student-card-footer"><span>{data.year ? `${L("Academic year", "শিক্ষাবর্ষ")} ${data.year}` : data.school}</span><span className="student-card-status">{data.status}</span></footer>
        </div>
      </section>
      <section aria-label={L("ID card back", "আইডি কার্ডের পেছনের অংশ")} className="student-card-card">
        <div className="student-card-back">
          <div className="student-card-backBrand"><ShieldCheck aria-hidden /><span>{L("A proud member of our school", "আমাদের স্কুলের গর্বিত সদস্য")}</span></div>
          <p className="student-card-backSchool">{data.school}</p>
          <p className="student-card-returnText">{L("If found, please return this card to the school office.", "কার্ডটি পাওয়া গেলে অনুগ্রহ করে স্কুলের অফিসে ফেরত দিন।")}</p>
          <div className="student-card-schoolContact">{data.address && <p>{data.address}</p>}{data.phone && <p>{L("School contact", "স্কুলের যোগাযোগ")}: {data.phone}</p>}</div>
          <div className="student-card-backFooter"><span>{data.code}</span><span>{L("School use only", "শুধু স্কুলে ব্যবহারের জন্য")}</span></div>
        </div>
      </section>
    </div>
    <div className="no-print mt-6 space-y-3">
      <Button type="button" size="lg" className="w-full" onClick={() => window.print()}><Printer className="size-5" />{L("Print / Save PDF", "প্রিন্ট / পিডিএফ সংরক্ষণ")}</Button>
      <p className="text-center text-xs leading-relaxed text-ink-2">{L("Front and back · 85.6 × 54 mm. Use A4, 100% scale and turn off headers/footers. Choose Save as PDF in the print dialog to download.", "সামনে ও পেছনে · ৮৫.৬ × ৫৪ মিমি। A4 ও ১০০% স্কেল ব্যবহার করুন, হেডার/ফুটার বন্ধ রাখুন। ডাউনলোড করতে প্রিন্ট ডায়ালগে Save as PDF বেছে নিন।")}</p>
      <p className="flex items-center justify-center gap-1 text-xs text-ink-2"><CheckCircle2 className="size-3.5" />{L("No guardian contact details are printed.", "অভিভাবকের যোগাযোগের তথ্য প্রিন্ট হয় না।")}</p>
    </div>
  </div>;
}
