"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const TABLES = [
  "students",
  "student_attendance",
  "payments",
  "invoice_items",
  "notices",
  "notifications",
  "expenses",
  "homework",
  "homework_status",
  "exams",
  "marks",
];
/** Receive authorized change signals, then reload through the authenticated server. */
export function LiveUpdates({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  useEffect(() => {
    const db = supabaseBrowser();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (
          document.visibilityState === "visible" &&
          !document.querySelector('form[data-unsaved="true"]')
        )
          router.refresh();
      }, 500);
    };
    const edited = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const form = target.closest("form");
        if (form && form.method.toLowerCase() !== "get")
          form.dataset.unsaved = "true";
      }
    };
    let channel = db.channel(`school-updates-${schoolId}`);
    for (const table of TABLES)
      for (const event of ["INSERT", "UPDATE"] as const) {
        channel = channel.on(
          "postgres_changes",
          {
            event,
            schema: "public",
            table,
            filter: `school_id=eq.${schoolId}`,
          },
          refresh,
        );
      }
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") refresh();
    });
    document.addEventListener("input", edited, true);
    document.addEventListener("change", edited, true);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("school:saved", refresh);
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
      document.removeEventListener("input", edited, true);
      document.removeEventListener("change", edited, true);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("school:saved", refresh);
    };
  }, [router, schoolId]);
  return null;
}
