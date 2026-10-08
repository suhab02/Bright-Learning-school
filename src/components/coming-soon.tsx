import { Suspense } from "react";
import { Construction } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { NavKey } from "@/lib/nav";
import { Card, Skeleton } from "./ui";

async function Inner({ section }: { section: NavKey }) {
  const { t } = await getT();
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">{t.nav[section]}</h1>
      <Card className="mt-4 flex items-start gap-4 p-6">
        <Construction className="size-6 shrink-0 text-due" aria-hidden />
        <p className="text-ink-2">{t.common.comingSoon}</p>
      </Card>
    </div>
  );
}
/** Honest placeholder for sections that are not implemented yet. */
export function ComingSoon({ section }: { section: NavKey }) {
  return <Suspense fallback={<Skeleton className="mx-auto h-40 max-w-3xl" />}><Inner section={section} /></Suspense>;
}
