import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { supabaseServer } from "@/lib/supabase/server";
import { Card, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
async function NoticeDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireContext();
  const [{ id }, { locale }, db] = await Promise.all([
    params,
    getT(),
    supabaseServer(),
  ]);
  const { data: n, error } = await db
    .from("notices")
    .select("title,body,created_at")
    .eq("id", id)
    .eq("school_id", ctx.schoolId)
    .maybeSingle();
  if (error) throw error;
  if (!n) notFound();
  return (
    <div>
      <PageHeader
        title={locale === "bn" ? "নোটিশ" : "Notice"}
        back={ctx.role === "guardian" ? "/portal" : "/notices"}
      />
      <Card className="p-4">
        <h1 className="text-xl font-bold">{n.title}</h1>
        <p className="my-2 text-sm text-ink-2">{n.created_at.slice(0, 10)}</p>
        <p className="whitespace-pre-wrap break-words">{n.body}</p>
      </Card>
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
