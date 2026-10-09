import { Suspense } from "react";
import { Hammer } from "lucide-react";
import { getT } from "@/lib/i18n/server";
import type { NavKey } from "@/lib/nav";
import { Card, Skeleton } from "./ui";
import { EmptyState, PageHeader } from "./page";

async function Inner({ section }: { section: NavKey }) {
  const { t } = await getT();
  return (
    <div>
      <PageHeader title={t.nav[section]} />
      <Card><EmptyState icon={Hammer} title={t.common.comingSoon} /></Card>
    </div>
  );
}
/** Honest placeholder for sections that are not implemented yet. */
export function ComingSoon({ section }: { section: NavKey }) {
  return <Suspense fallback={<Skeleton className="h-48" />}><Inner section={section} /></Suspense>;
}
