import { Suspense } from "react";
import { getPublicBranding } from "@/lib/school";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { LanguageSwitch } from "@/components/language-switch";
import { Skeleton } from "@/components/ui";
import { BookOpen, GraduationCap, ShieldCheck } from "lucide-react";

async function Brand() {
  const [b, locale] = await Promise.all([getPublicBranding(), getLocale()]);
  const name = b ? (locale === "bn" ? b.nameBn : b.nameEn) : "School Manager";
  const slogan = b ? (locale === "bn" ? b.sloganBn : b.sloganEn) : null;
  return (
    <div className="flex h-full flex-col justify-between text-white">
      <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b?.logoUrl ?? "/brand/logo.png"} alt="" className="size-12 shrink-0 rounded-xl bg-white object-contain p-1" />
      <div><h1 className="text-base font-semibold leading-tight">{name}</h1>{b?.place && <p className="mt-1 text-xs text-white/55">{b.place}</p>}</div>
      </div>
      <div className="py-9 lg:py-16">
        <p className="mb-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold">{locale === "bn" ? "স্কুলের নিজস্ব ডিজিটাল স্পেস" : "Your school. Connected."}</p>
        <h2 className="max-w-md text-[32px] font-medium leading-[1.16] tracking-[-0.04em] lg:text-[48px]">{locale === "bn" ? "শেখা ও পরিচালনা, সুন্দর এক জায়গায়।" : "More time for learning. Less time managing."}</h2>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">{slogan || (locale === "bn" ? "শিক্ষক, অভিভাবক ও স্কুলের কাজ—একটি ব্যক্তিগত ও সহজ কর্মক্ষেত্রে।" : "One private workspace for your school, its teachers and the families you support.")}</p>
        <div className="mt-9 hidden grid-cols-2 gap-3 lg:grid">
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4"><GraduationCap className="mb-3 size-5 text-gold" /><p className="text-xs font-medium">{locale === "bn" ? "শিক্ষার্থী ও পরিবার" : "Students & families"}</p><p className="mt-1 text-[11px] text-white/50">{locale === "bn" ? "সবার প্রয়োজনীয় তথ্য" : "The details that matter"}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/4 p-4"><BookOpen className="mb-3 size-5 text-gold" /><p className="text-xs font-medium">{locale === "bn" ? "দৈনন্দিন স্কুলের কাজ" : "Everyday schoolwork"}</p><p className="mt-1 text-[11px] text-white/50">{locale === "bn" ? "শুরু থেকে শেষ পর্যন্ত" : "Organised from start to finish"}</p></div>
        </div>
      </div>
      <p className="flex items-center gap-2 text-[11px] text-white/45"><ShieldCheck className="size-3.5" />{locale === "bn" ? "আমন্ত্রিত অ্যাকাউন্টের জন্য ব্যক্তিগত প্রবেশ" : "Private access for invited accounts"}</p>
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="mb-8 flex justify-end"><LanguageSwitch /></div>
      <div className="mx-auto w-full max-w-md">{children}</div>
      <p className="mx-auto mt-6 max-w-md text-center text-xs leading-relaxed text-ink-2">{locale === "bn" ? "আপনার অ্যাকাউন্টের ভূমিকা অনুযায়ী অপশন দেখানো হবে। প্রবেশের জন্য স্কুলের আমন্ত্রণ প্রয়োজন।" : "Your account role determines your tools. Ask the school for an invitation to get access."}</p>
    </LocaleProvider>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(360px,0.95fr)_minmax(480px,1.05fr)]">
      <div className="workspace-hero rounded-b-[28px] px-7 py-8 sm:px-12 lg:min-h-dvh lg:rounded-none lg:px-14 lg:py-12 xl:px-20">
        <Suspense fallback={<Skeleton className="mx-auto h-40 w-64 bg-white/10" />}><Brand /></Suspense>
      </div>
      <div className="px-5 py-7 sm:px-10 lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-12">
        <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-md" />}><Shell>{children}</Shell></Suspense>
      </div>
    </div>
  );
}
