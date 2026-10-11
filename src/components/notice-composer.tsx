"use client";
import { useActionState, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveWorkflow } from "@/lib/workflows/actions";
import type { NoticeDetails, NoticeSchool } from "@/lib/notice-template";
import { Button, Field, Input, Notice, Select, Textarea } from "./ui";
import { NoticeExport } from "./notice-export";
import { NoticeLetter } from "./notice-letter";

export function NoticeComposer({ id, school, locale, today, manager, sections, defaults }: {
  id: string; school: NoticeSchool; locale: "bn" | "en"; today: string; manager: boolean;
  sections: { id: string; label: string }[]; defaults: NoticeDetails;
}) {
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  const prefix = useId(); const router = useRouter();
  const [state, action, pending] = useActionState(saveWorkflow, {});
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const [details, setDetails] = useState(defaults);
  const [signatureError,setSignatureError] = useState(false);
  async function loadSignature(file: File | undefined) {
    if(!file)return;setSignatureError(false);
    if(!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>5*1024*1024){setSignatureError(true);return;}
    try {
      const bitmap=await createImageBitmap(file);const canvas=document.createElement("canvas");canvas.width=360;canvas.height=120;const context=canvas.getContext("2d");if(!context)throw new Error("canvas");
      const scale=Math.min(360/bitmap.width,120/bitmap.height);context.fillStyle="white";context.fillRect(0,0,360,120);context.drawImage(bitmap,(360-bitmap.width*scale)/2,(120-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close();
      const signature=canvas.toDataURL("image/jpeg",.8);if(signature.length>40000)throw new Error("size");setDetails(current=>({...current,signature}));
    }catch{setSignatureError(true);}
  }
  const [audience, setAudience] = useState(manager ? "all" : "sections");
  useEffect(() => { if (state.success && state.noticePath) { window.dispatchEvent(new Event("school:saved")); router.push(state.noticePath); } }, [state.success, state.noticePath, router]);
  const detailField = (key: keyof NoticeDetails, label: string, type = "text") => <Field key={key} label={label} htmlFor={`${prefix}-${key}`}><Input id={`${prefix}-${key}`} type={type} value={details[key] ?? ""} maxLength={key === "address" ? 500 : key === "signer" || key === "designation" ? 150 : 100} required={key === "date"} onChange={e => setDetails({...details,[key]:e.target.value})} /></Field>;
  return <details className="mb-5 rounded-[24px] border border-line bg-surface p-4">
    <summary className="cursor-pointer py-2 font-semibold text-brand">{L("Write a notice · school template", "নোটিশ লিখুন · স্কুলের টেমপ্লেট")}</summary>
    <p className="my-3 text-sm text-ink-2">{L("Write your notice below. The logo, letterhead and layout are added automatically. Review the preview before publishing.", "নিচে নোটিশ লিখুন। লোগো, স্কুলের পরিচিতি ও সাজানো টেমপ্লেট স্বয়ংক্রিয়ভাবে যোগ হবে। প্রকাশের আগে প্রিভিউ দেখে নিন।")}</p>
    <form action={action} className="space-y-4" data-unsaved={Boolean(title || body) && !state.success}>
      <input type="hidden" name="operation" value="notice" /><input type="hidden" name="id" value={id} /><input type="hidden" name="locale" value={locale} /><input type="hidden" name="template_details" value={JSON.stringify(details)} />
      <fieldset disabled={pending} className="space-y-4">
        <Field label={L("Notice title", "নোটিশের শিরোনাম")} htmlFor={`${prefix}-title`}><Input id={`${prefix}-title`} name="title" value={title} onChange={e=>setTitle(e.target.value)} required maxLength={1000} /></Field>
        <Field label={L("Notice text", "নোটিশের লেখা")} htmlFor={`${prefix}-body`}><Textarea id={`${prefix}-body`} name="body" value={body} onChange={e=>setBody(e.target.value)} required maxLength={10000} rows={8} placeholder={L("Write the complete notice, including any greeting…", "সম্বোধনসহ সম্পূর্ণ নোটিশ লিখুন…")} /></Field>
        <div className="grid grid-cols-2 gap-3">{detailField("date",L("Notice date","নোটিশের তারিখ"),"date")}{detailField("reference",L("Reference (optional)","সূত্র (ঐচ্ছিক)"))}</div>
        {detailField("signer",L("Sign-off name (optional)","স্বাক্ষরকারীর নাম (ঐচ্ছিক)"))}{detailField("designation",L("Designation (optional)","পদবি (ঐচ্ছিক)"))}
        <div className="rounded-xl border border-line p-3"><Field label={L("Teacher signature (optional)","শিক্ষকের স্বাক্ষর (ঐচ্ছিক)")} htmlFor={`${prefix}-signature`}><Input id={`${prefix}-signature`} type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>loadSignature(e.target.files?.[0])} /></Field><p className="mt-2 text-xs text-ink-2">{L("Upload your own signature image. It will appear on the notice, PDF and print copy.","নিজের স্বাক্ষরের ছবি যোগ করুন। নোটিশ, PDF ও প্রিন্ট কপিতে এটি দেখা যাবে।")}</p>{details.signature && <Button type="button" variant="ghost" size="sm" onClick={()=>setDetails(current=>({...current,signature:""}))}>{L("Remove signature","স্বাক্ষর সরান")}</Button>}{signatureError && <Notice tone="error">{L("Choose a clear JPG, PNG or WebP signature image under 5 MB.","৫ MB-এর কম পরিষ্কার JPG, PNG বা WebP স্বাক্ষরের ছবি বাছুন।")}</Notice>}</div>
        <details className="rounded-xl border border-line p-3"><summary className="cursor-pointer font-medium">{L("Logo & letterhead details", "লোগো ও স্কুলের পরিচিতি")}</summary><div className="mt-3 space-y-3"><p className="text-xs text-ink-2">{L("Uses the school logo. Check these details before publishing.","স্কুলের লোগো ব্যবহার হবে। প্রকাশের আগে তথ্যগুলো যাচাই করুন।")}</p>{manager && <Link className="inline-block py-2 text-sm text-brand underline" href="/settings">{L("Change school logo in Settings", "সেটিংসে স্কুলের লোগো বদলান")}</Link>}{detailField("address",L("Address","ঠিকানা"))}{detailField("phone",L("Phone","মোবাইল"))}{detailField("code",L("School code","স্কুল কোড"))}{detailField("established",L("Established","স্থাপিত"))}</div></details>
        <Field label={L("Audience","কার জন্য")} htmlFor={`${prefix}-audience`}><Select id={`${prefix}-audience`} name="audience" value={audience} onChange={e=>setAudience(e.target.value)}>{manager && <><option value="all">{L("Everyone","সবার জন্য")}</option><option value="staff">{L("Staff","কর্মীদের জন্য")}</option><option value="guardians">{L("Guardians","অভিভাবকদের জন্য")}</option></>}<option value="sections">{L("One class / section","একটি শ্রেণি / শাখা")}</option></Select></Field>
        {audience === "sections" && <Field label={L("Class / section","শ্রেণি / শাখা")} htmlFor={`${prefix}-section`}><Select id={`${prefix}-section`} name="section_id" required defaultValue=""><option value="">{L("Choose","নির্বাচন করুন")}</option>{sections.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</Select></Field>}
      </fieldset>
      <div data-notice-export className="border-t border-line pt-4"><p className="no-print mb-3 text-sm font-semibold">{L("Live preview","লাইভ প্রিভিউ")}</p><NoticeLetter school={school} title={title} body={body} date={today} details={details} locale={locale} /><NoticeExport locale={locale} title={title} preview /></div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {!manager && !sections.length && <Notice tone="warn">{L("A class must be assigned to you before you can publish a notice.","নোটিশ প্রকাশ করতে আপনার নামে শ্রেণি বরাদ্দ থাকতে হবে।")}</Notice>}
      <Button type="submit" className="w-full" disabled={pending || Boolean(state.success) || (!manager && !sections.length)}>{pending ? L("Publishing…","প্রকাশ হচ্ছে…") : L("Publish this notice","এই নোটিশ প্রকাশ করুন")}</Button>
    </form>
  </details>;
}
