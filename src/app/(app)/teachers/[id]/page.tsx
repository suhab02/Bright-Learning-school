import { Suspense } from "react";
import { SchoolModule } from "@/components/school-module";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Teacher profile" };
async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SchoolModule kind="teachers" teacherId={id} />;
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<Skeleton className="h-96" />}><Profile params={params} /></Suspense>;
}
