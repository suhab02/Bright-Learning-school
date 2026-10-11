import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
import { NoticeLetter } from "@/components/notice-letter";
import { NoticePrintButton } from "@/components/notice-composer";
import { getNoticeSchool } from "@/lib/data/notice-template";
import { readNoticeDetails } from "@/lib/notice-template";
async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const [{ id }, { locale }, db, school] = await Promise.all([
    params,
    getT(),
    supabaseServer(),
    getNoticeSchool(ctx.schoolId),
  ]);
  const { data: n, error } = await db
    .from("notices")
    .select("title,body,created_at,template_details,is_published")
    .eq("id", id)
    .eq("school_id", ctx.schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!n) notFound();
  return (
    <div className="notice-print-view">
      <div className="no-print"><PageHeader
        title={locale === "bn" ? "নোটিশ" : "Notice"}
        back={ctx.role === "guardian" ? "/portal" : "/notices"}
      /></div>
      {!n.is_published && <p className="mb-3 font-semibold">{locale === "bn" ? "প্রত্যাহার করা হয়েছে" : "Withdrawn"}</p>}
      <NoticePrintButton locale={locale} />
      <NoticeLetter school={school} title={n.title} body={n.body} date={n.created_at.slice(0,10)} details={readNoticeDetails(n.template_details)} locale={locale} />
    </div>
  );
}
export default function Page({ params }: PageProps<"/notices/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <NoticeDetail params={params} />
    </Suspense>
  );
}
