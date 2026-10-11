import { z } from "zod";

export const noticeDetailsSchema = z.object({
  date: z.iso.date().optional(),
  reference: z.string().trim().max(100).default(""),
  signer: z.string().trim().max(150).default(""),
  designation: z.string().trim().max(150).default(""),
  address: z.string().trim().max(500).default(""),
  phone: z.string().trim().max(100).default(""),
  code: z.string().trim().max(100).default(""),
  established: z.string().trim().max(100).default(""),
});
export type NoticeDetails = z.infer<typeof noticeDetailsSchema>;
export type NoticeSchool = { nameEn: string; nameBn: string; logo: string; address: string; phone: string; code: string; established: string; signer: string };
export function readNoticeDetails(value: unknown): Partial<NoticeDetails> {
  const parsed = noticeDetailsSchema.partial().safeParse(value);
  return parsed.success ? parsed.data : {};
}
export function noticeDate(date: string, locale: "bn" | "en") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
