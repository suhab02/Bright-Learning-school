import { Suspense } from "react";
import { ParentModule } from "@/components/parent-module";
import { Skeleton } from "@/components/ui";
export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <ParentModule kind="profile" />
    </Suspense>
  );
}
