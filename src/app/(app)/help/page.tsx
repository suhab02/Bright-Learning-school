import { Suspense } from "react";
import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { requireContext } from "@/lib/auth";
import { Card, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
import { RoleAccessGuide } from "@/components/role-access-guide";
async function Help() {
  const ctx = await requireContext();
  const { locale, t } = await getT();
  const L = (en: string, bn: string) => (locale === "bn" ? bn : en);
  return (
    <div>
      <PageHeader title={t.nav.help} />
      <RoleAccessGuide />
      <Card className="space-y-4 p-4">
        <p>
          {L(
            "Install this app: Android → Chrome menu → Install app. iPhone → Safari Share → Add to Home Screen.",
            "অ্যাপ ইনস্টল করুন: Android → Chrome মেনু → Install app। iPhone → Safari Share → Add to Home Screen।",
          )}
        </p>
        {ctx.role === "guardian" ? (
          <p>
            {L(
              "The office must invite your email and link your child's record. Only published homework and results appear in the parent portal.",
              "অফিস আপনার ইমেইলে আমন্ত্রণ তৈরি করে শিক্ষার্থীর রেকর্ড যুক্ত করবে। অভিভাবক পোর্টালে শুধু প্রকাশিত বাড়ির কাজ ও ফলাফল দেখা যায়।",
            )}
          </p>
        ) : (
          <>
            <p>
              {L(
                "Start with classes and subjects, then staff and teacher assignments, then admit students. Configure fees before billing.",
                "প্রথমে শ্রেণি ও বিষয়, তারপর কর্মী ও শিক্ষকের দায়িত্ব নির্ধারণ করুন। শিক্ষার্থী ভর্তি করুন। ফি ধার্যের আগে ফি নির্ধারণ করুন।",
              )}
            </p>
            <p>
              {L(
                "Attendance uses active students in the current academic year. Past-day changes require correction permission and a reason.",
                "হাজিরায় বর্তমান শিক্ষাবর্ষের সক্রিয় শিক্ষার্থীরা থাকে। পুরোনো দিনের পরিবর্তনে সংশোধনের অনুমতি ও কারণ প্রয়োজন।",
              )}
            </p>
            <p>
              {L(
                "Invitation links last 7 days. Share them with the intended email owner. Staff invitations and permission changes are controlled by the school owner.",
                "আমন্ত্রণ লিংকের মেয়াদ ৭ দিন। সংশ্লিষ্ট ইমেইলের মালিককে লিংক দিন। কর্মীর আমন্ত্রণ ও অনুমতি পরিবর্তন স্কুল মালিক নিয়ন্ত্রণ করেন।",
              )}
            </p>
            <Link href="/classes" className="block font-semibold text-brand">
              {t.nav.classes}
            </Link>
            <Link href="/teachers" className="block font-semibold text-brand">
              {t.nav.teachers}
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Help />
    </Suspense>
  );
}
