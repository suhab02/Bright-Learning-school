import { Suspense } from "react";
import { getPublicBranding } from "@/lib/school";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { LanguageSwitch } from "@/components/language-switch";
import { Skeleton } from "@/components/ui";

async function Brand() {
  const [b, locale] = await Promise.all([getPublicBranding(), getLocale()]);
  const name = b ? (locale === "bn" ? b.nameBn : b.nameEn) : "School Manager";
  const slogan = b ? (locale === "bn" ? b.sloganBn : b.sloganEn) : null;
  return (
    <div className="flex flex-col items-center text-center gap-3 text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={b?.logoUrl ?? "/brand/logo.png"} alt="" className="size-28 rounded-3xl bg-white object-contain p-2 shadow-lg shadow-black/20" />
      <h1 className="text-2xl font-bold leading-tight">{name}</h1>
      {b?.place && <p className="text-white/75 text-sm">{b.place}</p>}
      {slogan && <p className="text-white/90">{slogan}</p>}
      <div className="stitch w-40 text-sun mt-1" aria-hidden />
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="absolute right-4 top-4"><LanguageSwitch /></div>
      <div className="mx-auto w-full max-w-md px-4 pb-10">{children}</div>
    </LocaleProvider>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[color-mix(in_oklab,var(--brand)_8%,var(--bg))]">
    <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg sm:shadow-2xl sm:shadow-brand/15">
      <div className="bg-brand px-6 pt-14 pb-16">
        <Suspense fallback={<Skeleton className="mx-auto h-40 w-64 bg-white/10" />}><Brand /></Suspense>
      </div>
      <div className="-mt-10 flex-1">
        <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-md" />}><Shell>{children}</Shell></Suspense>
      </div>
    </div>
    </div>
  );
}
