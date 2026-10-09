import { Suspense } from "react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getFeeSetup } from "@/lib/data/fees";
import { getSchool } from "@/lib/data/school";
import { toBnDigits } from "@/lib/format";
import { Notice, Skeleton } from "@/components/ui";
import { PageHeader } from "@/components/page";
import { RatesForm } from "./rates-form";
import { AddCategory } from "./add-category";

export const metadata = { title: "Fee rates" };

async function Setup() {
  const ctx = await requireContext();
  const { t, locale } = await getT();
  if (!can(ctx, "fees.configure")) return <Notice tone="warn">{t.common.permissionDenied}</Notice>;
  const [{ categories, classes, year, rateMap }, school] = await Promise.all([getFeeSetup(ctx.schoolId), getSchool(ctx.schoolId)]);
  const yearName = year ? (locale === "bn" && school.use_bengali_digits ? toBnDigits(year.name) : year.name) : null;
  return (
    <div>
      <PageHeader title={t.fees.setup} subtitle={yearName ? `${t.common.academicYear} ${yearName}` : undefined} back="/fees" />
      <Notice className="mb-4">{t.fees.setupHint}</Notice>
      <div className="flex flex-col gap-4">
        {categories.filter((c) => c.is_active).map((c) => (
          <RatesForm key={c.id} category={c} classes={classes} rates={rateMap[c.id] ?? {}} />
        ))}
        <AddCategory />
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="space-y-4"><Skeleton className="h-12 w-48" /><Skeleton className="h-96" /></div>}><Setup /></Suspense>;
}
