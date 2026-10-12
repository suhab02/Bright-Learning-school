import { Suspense } from "react";
import { requireContext,can } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool,schoolName } from "@/lib/data/school";
import { PageHeader } from "@/components/page";
import { Card,Skeleton } from "@/components/ui";
import { FacebookUpdates } from "@/components/facebook/updates";
import { FacebookPageForm } from "./forms";
export const metadata={title:"Facebook Updates"};
async function Updates() {
  const ctx=await requireContext();const [{locale},school]=await Promise.all([getT(),getSchool(ctx.schoolId)]);const L=(en:string,bn:string)=>locale==='bn'?bn:en;
  return <div className="space-y-5"><PageHeader title={L('Facebook updates','ফেসবুকের নতুন পোস্ট')} subtitle={L('See what is happening at our school','স্কুলের নতুন খবর দেখুন')}/><FacebookUpdates pageUrl={school.facebook_page_url} locale={locale} schoolName={schoolName(school,locale)}/><p className="px-1 text-sm leading-relaxed text-ink-2">{L('Tap to open the school’s public Facebook timeline in a popup. Facebook content loads only when you open it.','স্কুলের পাবলিক ফেসবুক টাইমলাইন পপআপে খুলতে ট্যাপ করুন। খুললেই কেবল ফেসবুকের কনটেন্ট লোড হবে।')}</p>{can(ctx,'settings.manage')&&<Card className="space-y-4 p-4"><h2 className="font-semibold">{L('School Page','স্কুলের পেজ')}</h2><FacebookPageForm pageUrl={school.facebook_page_url} locale={locale}/></Card>}</div>;
}
export default function Page(){return <Suspense fallback={<Skeleton className="h-80"/>}><Updates/></Suspense>;}
