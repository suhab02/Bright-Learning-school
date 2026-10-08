// Money is stored as integer POISHA (৳1 = 100). Never use floats for money.
const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

export function toBnDigits(s: string): string {
  return s.replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}
export function fromBnDigits(s: string): string {
  return s.replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
}

/** Group digits the South Asian way: 12,34,567 */
function groupIndian(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${rest},${last3}`;
}

export type NumOpts = { bnDigits?: boolean };

export function formatNumber(n: number | bigint, o: NumOpts = {}): string {
  const neg = n < 0;
  const s = groupIndian((neg ? -BigInt(n) : BigInt(n)).toString());
  const out = (neg ? "-" : "") + s;
  return o.bnDigits ? toBnDigits(out) : out;
}

/** 150000 poisha → "৳1,500" (paisa shown only when non-zero) */
export function formatTaka(poisha: number | bigint | string | null | undefined, o: NumOpts = {}): string {
  const p = BigInt(poisha ?? 0);
  const neg = p < 0n;
  const abs = neg ? -p : p;
  const taka = abs / 100n;
  const paisa = abs % 100n;
  let s = groupIndian(taka.toString());
  if (paisa > 0n) s += "." + paisa.toString().padStart(2, "0");
  s = (neg ? "-" : "") + "৳" + s;
  return o.bnDigits ? toBnDigits(s) : s;
}

/** Parse user input "1,500.50" or "১৫০০" → poisha (bigint). Returns null if invalid. */
export function parseTaka(input: string): bigint | null {
  const s = fromBnDigits(input).replace(/[,৳\s]/g, "");
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? "0").padEnd(2, "0"));
}

export const TZ = "Asia/Dhaka";

export function formatDate(d: Date | string, locale: "bn" | "en", o: NumOpts = {}): string {
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T00:00:00+06:00" : d) : d;
  const s = new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
    timeZone: TZ, day: "numeric", month: "long", year: "numeric",
  }).format(date);
  // Intl already uses Bangla digits for bn-BD; force Latin digits if the school prefers them
  return locale === "bn" && !o.bnDigits ? fromBnDigits(s) : s;
}

/** Today's date in Dhaka as YYYY-MM-DD */
export function dhakaToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}
export function dhakaHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
}
