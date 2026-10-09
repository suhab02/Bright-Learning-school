"use client";
import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/client";
import { removeSchoolRecord } from "@/lib/workflows/removal";

export function AdminDelete({ table, id, name }: { table: string; id: string; name: string }) {
  const locale = useLocale();
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  const router = useRouter();
  const uid = useId();
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const archive = table === "students" || table === "staff";
  const label = archive ? L("Archive", "সংরক্ষণ করুন") : L("Delete", "মুছে ফেলুন");
  const submit = async () => {
    if (!confirm || reason.trim().length < 3 || busy) return;
    setBusy(true); setError("");
    try {
      const result = await removeSchoolRecord(table, id, reason);
      if (!result.ok) setError(result.error);
      else { setOpen(false); setReason(""); setConfirm(false); router.refresh(); }
    } catch { setError("save"); } finally { setBusy(false); }
  };
  return <div className="mt-3 border-t border-line pt-3">
    <button type="button" className="min-h-11 text-sm font-semibold text-danger" onClick={() => { setOpen(!open); setError(""); }}>{label} · {L("Admin only", "শুধু অ্যাডমিন")}</button>
    {open && <div className="space-y-3 rounded-xl bg-surface-2 p-3">
      <p className="break-words font-semibold">{name}</p>
      <p className="text-sm">{archive ? L("Keep this record and its history, but mark the student as withdrawn or the staff member as resigned. This does not suspend a sign-in account.", "রেকর্ড ও ইতিহাস থাকবে; শিক্ষার্থী স্কুল ছেড়েছে বা কর্মী পদত্যাগ করেছে হিসেবে চিহ্নিত হবে। সাইন ইন অ্যাকাউন্ট বন্ধ হবে না।") : L("Deletion is permanent. Records linked to other data and published results are protected; remove unused records only.", "মুছে ফেলা স্থায়ী। অন্য তথ্যের সঙ্গে যুক্ত রেকর্ড ও প্রকাশিত ফলাফল সুরক্ষিত; শুধু অব্যবহৃত রেকর্ড মুছুন।")}</p>
      <label htmlFor={uid} className="block text-sm font-semibold">{L("Reason", "কারণ")}</label>
      <input id={uid} value={reason} onChange={e => setReason(e.target.value)} maxLength={300} disabled={busy} className="w-full rounded-xl border border-line bg-surface p-3" />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirm} onChange={e => setConfirm(e.target.checked)} disabled={busy} className="mt-1" />{L("I checked the record and confirm this action.", "রেকর্ড যাচাই করেছি এবং নিশ্চিত করছি।")}</label>
      {error && <p role="alert" className="text-sm text-danger">{error === "linked" ? L("This record is linked to other data. Remove its links first; its history cannot be deleted here.", "রেকর্ডটি অন্য তথ্যের সঙ্গে যুক্ত। আগে সংযোগ সরান; এখানে ইতিহাস মুছে ফেলা যাবে না।") : error === "history" ? L("Published results and approved expenses cannot be deleted. Use the correction or cancellation workflow.", "প্রকাশিত ফলাফল ও অনুমোদিত খরচ মুছবেন না। সংশোধন বা বাতিলের অপশন ব্যবহার করুন।") : L("Could not save. Check your access and try again.", "সংরক্ষণ করা যায়নি। অনুমতি যাচাই করে আবার চেষ্টা করুন।")}</p>}
      <div className="flex gap-3"><button type="button" disabled={busy || !confirm || reason.trim().length < 3} onClick={() => void submit()} className="min-h-11 rounded-xl bg-danger px-3 font-semibold text-white disabled:opacity-40">{busy ? L("Saving…", "সংরক্ষণ হচ্ছে…") : label}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-11 px-3">{L("Cancel", "বাতিল")}</button></div>
    </div>}
  </div>;
}
