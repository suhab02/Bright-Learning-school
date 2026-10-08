"use client";
import { createContext, useContext } from "react";
import { getDictionary, type Locale } from ".";

const Ctx = createContext<Locale>("bn");
export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <Ctx value={locale}>{children}</Ctx>;
}
export function useLocale() { return useContext(Ctx); }
export function useT() { const locale = useContext(Ctx); return { locale, t: getDictionary(locale) }; }
