import { Suspense } from "react";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { schoolToday } from "@/lib/data/attendance";
import { Skeleton } from "@/components/ui";
import { NotificationCentre, type NotificationRow } from "@/components/notification-centre";

async function List() {
  const ctx=await requireContext();
  const [{locale},db,today]=await Promise.all([getT(),supabaseServer(),schoolToday(ctx.schoolId)]);
  const {data,error}=await db.from("notifications").select("id,kind,title,body,link,read_at,created_at")
    .eq("user_id",ctx.userId).eq("school_id",ctx.schoolId).order("created_at",{ascending:false}).limit(100);
  if(error)throw error;
  return <NotificationCentre rows={(data??[]) as NotificationRow[]} locale={locale} today={today} />;
}
export default function Page(){return <Suspense fallback={<Skeleton className="h-96" />}><List /></Suspense>;}
