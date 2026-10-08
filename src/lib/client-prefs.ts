"use client";
// Small per-device preferences (language, theme, sidebar). Not data — never authoritative.
type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());
export const subscribePrefs = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(document.cookie);
  return m ? decodeURIComponent(m[1]) : null;
}
export function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
  emit();
}
export function setDocumentLang(l: string) { document.documentElement.lang = l; }

export type Theme = "light" | "dark" | "system";
export function readTheme(): Theme {
  const v = readCookie("bls_theme");
  return v === "light" || v === "dark" ? v : "system";
}
export function applyTheme(v: Theme) {
  writeCookie("bls_theme", v);
  const dark = v === "dark" || (v === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function readSidebarCollapsed(): boolean {
  try { return localStorage.getItem("bls_sidebar") === "1"; } catch { return false; }
}
export function writeSidebarCollapsed(v: boolean) {
  try { localStorage.setItem("bls_sidebar", v ? "1" : "0"); } catch { /* storage unavailable */ }
  emit();
}
