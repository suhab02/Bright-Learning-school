import { Suspense } from "react";
import Link from "next/link";
import { refresh } from "next/cache";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { Button, Card, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";

async function markAllRead() {
  "use server";
  await requireContext();
  const supabase = await supabaseServer();
  // RLS limits this to the signed-in user's own notifications
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  refresh();
}

async function List() {
  await requireContext();
  const [{ locale, t }, supabase] = await Promise.all([getT(), supabaseServer()]);
  const { data } = await supabase.from("notifications").select("id,title,body,link,read_at,created_at")
    .order("created_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t.common.notifications}</h1>
        {rows.some((r) => !r.read_at) && (
          <form action={markAllRead}><Button variant="secondary" size="sm" type="submit">✓ {locale === "bn" ? "সব পড়া হয়েছে" : "Mark all as read"}</Button></form>
        )}
      </div>
      {rows.length === 0 ? <Card className="p-6 text-ink-2">{t.common.noNotifications}</Card> : (
        <ul className="space-y-2">
          {rows.map((n) => (
            <li key={n.id}>
              <Card className={cn("p-4", !n.read_at && "border-l-4 border-l-accent")}>
                <Link href={n.link ?? "#"} className="block">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-ink-2 line-clamp-2">{n.body}</p>}
                  <p className="mt-2 text-xs text-ink-2">{formatDate(n.created_at, locale)}</p>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink-2">
        {locale === "bn" ? "এগুলো শুধু অ্যাপের ভেতরের বিজ্ঞপ্তি — কোনো SMS বা ইমেইল পাঠানো হয়নি।"
          : "These are in-app notifications only — no SMS or email was sent."}
      </p>
    </div>
  );
}
export default function Page() { return <Suspense fallback={<Skeleton className="mx-auto h-60 max-w-3xl" />}><List /></Suspense>; }
