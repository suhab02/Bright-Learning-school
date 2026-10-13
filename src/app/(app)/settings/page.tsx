import { Suspense } from "react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool } from "@/lib/data/school";
import { Notice, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
import { SchoolForm } from "./school-form";
import { LogoUpload } from "./logo-upload";
import { SmsSettings } from "@/components/sms-settings";

export const metadata = { title: "Settings" };

async function Settings() {
  const ctx = await requireContext();
  const [{ t, locale }, school] = await Promise.all([getT(), getSchool(ctx.schoolId)]);
  if (ctx.role === "guardian") return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const readOnly = !can(ctx, "settings.manage");
  return (
    <div className="space-y-5">
      <PageHeader title={t.settings.schoolProfile} subtitle={t.settings.profileHint} />
      <LogoUpload schoolId={school.id} logoUrl={school.logoUrl} custom={school.customLogo} readOnly={readOnly} />
      <SchoolForm school={school} readOnly={readOnly} />
      {ctx.role === "super_admin" && <SmsSettings schoolId={ctx.schoolId} locale={locale} />}
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="space-y-5"><Skeleton className="h-12 w-72" /><Skeleton className="h-32" /><Skeleton className="h-96" /></div>}><Settings /></Suspense>;
}
