import { Suspense } from "react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { Notice, Skeleton } from "@/components/ui";
import { SchoolForm } from "./school-form";
import { LogoUpload } from "./logo-upload";

export const metadata = { title: "Settings" };

async function Settings() {
  const ctx = await requireContext();
  const [{ t }, school] = await Promise.all([getT(), getSchool(ctx.schoolId)]);
  if (ctx.role === "guardian") return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const readOnly = !can(ctx, "settings.manage");
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">{t.settings.schoolProfile}</h1>
        <p className="text-ink-2">{t.settings.profileHint}</p>
      </div>
      <LogoUpload schoolId={school.id} logoUrl={school.logoUrl} readOnly={readOnly} />
      <SchoolForm school={school} readOnly={readOnly} />
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="mx-auto max-w-4xl space-y-5"><Skeleton className="h-12 w-72" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div>}><Settings /></Suspense>;
}
