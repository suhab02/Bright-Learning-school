import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { Card, Skeleton } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out";

async function Body() {
  const { t } = await getT();
  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold">{t.auth.noAccessTitle}</h1>
      <p className="mt-2 text-ink-2">{t.auth.noAccessBody}</p>
      <div className="mt-5"><SignOutButton label={t.common.signOut} /></div>
    </Card>
  );
}
export default function NoAccess() {
  return <main className="mx-auto max-w-md p-4 pt-16"><Suspense fallback={<Skeleton className="h-48" />}><Body /></Suspense></main>;
}
