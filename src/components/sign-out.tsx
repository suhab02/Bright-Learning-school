"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "./ui";

export function SignOutButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  return (
    <Button variant="secondary" className={className} onClick={async () => {
      await supabaseBrowser().auth.signOut();
      router.replace("/login");
      router.refresh();
    }}>
      <LogOut className="size-4" aria-hidden />{label}
    </Button>
  );
}
