import "server-only";
import { cookies } from "next/headers";
import { getDictionary, isLocale, LOCALE_COOKIE, type Locale } from ".";

/** Locale comes from the user's cookie; default Bengali. Request-time read. */
export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "bn";
}
export async function getT() {
  const locale = await getLocale();
  return { locale, t: getDictionary(locale) };
}
