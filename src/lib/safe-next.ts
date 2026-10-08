/** Only allow same-site relative redirects (blocks open-redirect attacks like //evil.com). */
export function safeNext(v: string | null | undefined, fallback = "/") {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}
