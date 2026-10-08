import { Suspense } from "react";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { UpdatePasswordForm } from "./form";

async function Inner() {
  return <LocaleProvider locale={await getLocale()}><UpdatePasswordForm /></LocaleProvider>;
}
export default function Page() {
  return <main className="mx-auto max-w-md p-4 pt-16"><Suspense><Inner /></Suspense></main>;
}
