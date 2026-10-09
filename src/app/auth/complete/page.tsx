import { Suspense } from "react";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { Skeleton } from "@/components/ui";
import { CompleteSignIn } from "./complete";

export const metadata = { title: "Signing in" };

async function Inner() {
  return <LocaleProvider locale={await getLocale()}><CompleteSignIn /></LocaleProvider>;
}
export default function Page() {
  return <main className="mx-auto max-w-md p-4 pt-16"><Suspense fallback={<Skeleton className="h-40" />}><Inner /></Suspense></main>;
}
