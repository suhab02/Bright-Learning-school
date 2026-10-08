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
      {b?.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logoUrl} alt="" className="size-20 rounded-2xl bg-white object-contain p-1.5" />
      ) : (
        <div aria-hidden className="grid size-20 place-items-center rounded-2xl bg-white/10 text-3xl font-bold">
          {name.slice(0, 1)}
        </div>
      )}
      <h1 className="text-2xl font-bold leading-tight">{name}</h1>
      {b?.place && <p className="text-white/75 text-sm">{b.place}</p>}
      {slogan && <p className="text-white/90">{slogan}</p>}
      <div className="stitch w-40 text-due/80 mt-1" aria-hidden />
    </div>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <LocaleProvider locale={locale}>
      <div className="flex justify-end p-4"><LanguageSwitch /></div>
      <div className="mx-auto w-full max-w-md px-4 pb-10">{children}</div>
    </LocaleProvider>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="bg-brand px-6 pt-10 pb-16">
        <Suspense fallback={<Skeleton className="mx-auto h-40 w-64 bg-white/10" />}><Brand /></Suspense>
      </div>
      <div className="-mt-10 flex-1">
        <Suspense fallback={<Skeleton className="mx-auto h-80 max-w-md" />}><Shell>{children}</Shell></Suspense>
      </div>
    </div>
  );
}
