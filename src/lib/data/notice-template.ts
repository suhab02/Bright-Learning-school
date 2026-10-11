import "server-only";
import { getSchool, schoolPlace } from "./school";
import type { NoticeDetails, NoticeSchool } from "../notice-template";

export async function getNoticeSchool(schoolId: string): Promise<NoticeSchool> {
  const s = await getSchool(schoolId);
  return { nameEn:s.name_en, nameBn:s.name_bn, logo:s.logoUrl, address:s.address_line || schoolPlace(s), phone:s.phone || "", code:s.registration_no || "", established:s.established_year ? String(s.established_year) : "", signer:s.head_teacher_name || "" };
}
/** Initial letterhead taken from the supplied school notice; editable per notice. */
export function noticeDefaults(school: NoticeSchool, date: string, locale: "bn" | "en"): NoticeDetails {
  const referenceSchool = school.nameEn.trim().toLowerCase() === "bright learning school";
  return { date, reference:"", signer:referenceSchool ? "শাব্বির আহমদ" : school.signer, designation:locale === "bn" ? "প্রধান শিক্ষক" : "Head teacher", address:referenceSchool ? "ডাক: রহিমিয়া মাদরাসা, উপজেলা: কানাইঘাট, জেলা: সিলেট" : school.address, phone:referenceSchool ? "০১৮৯৩-৩৫৪৩৯৫" : school.phone, code:referenceSchool ? "৪৯১৮৫৬" : school.code, established:referenceSchool ? "২৪-০১-২০২৪" : school.established };
}
