import en from "./en";
import bn from "./bn";
import type { Dictionary } from "./en";

export type Locale = "bn" | "en";
export const LOCALE_COOKIE = "bls_locale";
export const locales: Locale[] = ["bn", "en"];
export const isLocale = (v: unknown): v is Locale => v === "bn" || v === "en";
export function getDictionary(locale: Locale): Dictionary {
  return locale === "en" ? en : bn;
}
export type { Dictionary };
