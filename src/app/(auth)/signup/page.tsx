import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { Skeleton } from "@/components/ui";

export const metadata = { title: "Create account" };
export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return <Suspense fallback={<Skeleton className="h-96" />}><SignupForm searchParams={searchParams} /></Suspense>;
}
