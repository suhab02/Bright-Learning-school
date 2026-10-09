import { Suspense } from "react";
import { SchoolModule } from "@/components/school-module";
import { Skeleton } from "@/components/ui";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <SchoolModule kind="staff" />
    </Suspense>
  );
}
