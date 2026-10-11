import type { NoticeDetails, NoticeSchool } from "@/lib/notice-template";
import { noticeDate } from "@/lib/notice-template";
import "./notice-letter.css";

export function NoticeLetter({ school, title, body, date, details = {}, locale }: {
  school: NoticeSchool; title: string; body: string; date: string; details?: Partial<NoticeDetails>; locale: "bn" | "en";
}) {
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  const address = details.address ?? school.address;
  const phone = details.phone ?? school.phone;
  const code = details.code ?? school.code;
  const established = details.established ?? school.established;
  return <article className="notice-letter" aria-label={L("School notice preview", "স্কুলের নোটিশের প্রিভিউ")} lang={locale}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="notice-letter-watermark" src={school.logo} alt="" aria-hidden="true" />
    <header className="notice-letter-header">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="notice-letter-logo" src={school.logo} alt={L("School logo", "স্কুলের লোগো")} />
      <div className="notice-letter-brand"><p className="notice-letter-en">{school.nameEn}</p><p className="notice-letter-bn">{school.nameBn}</p><p className="notice-letter-address">{address}</p>
        <div className="notice-letter-contact">{code && <span>{L("School code", "স্কুল কোড")}: {code}</span>}{phone && <span>{L("Phone", "মোবাইল")}: {phone}</span>}{established && <span>{L("Established", "স্থাপিত")}: {established}</span>}</div>
      </div>
    </header>
    <div className="notice-letter-meta"><span>{L("Reference", "স্মারক নং")}: {details.reference || "—"}</span><span>{L("Date", "তারিখ")}: {noticeDate(details.date || date, locale)}</span></div>
    <div className="notice-letter-heading"><span>{L("School notice", "স্কুলের বিজ্ঞপ্তি")}</span><h2>{title || L("Notice title", "নোটিশের শিরোনাম")}</h2></div>
    <div className="notice-letter-body">{body || L("Your notice text will appear here.", "আপনার নোটিশের লেখা এখানে দেখা যাবে।")}</div>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <footer className="notice-letter-signoff">{details.signature && <img className="notice-letter-signature" src={details.signature} alt={L("Teacher signature", "শিক্ষকের স্বাক্ষর")} />}<div className="notice-letter-signature-line" /><p className="notice-letter-signer">{details.signer || ""}</p><p>{details.designation || ""}</p><p>{locale === "bn" ? school.nameBn : school.nameEn}</p></footer>
  </article>;
}
