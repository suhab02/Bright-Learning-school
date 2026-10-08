import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";

async function Go(): Promise<never> {
  const ctx = await requireContext();
  redirect(ctx.role === "guardian" ? "/portal" : "/dashboard");
}
export default function Home() {
  return <Suspense><Go /></Suspense>;
}
