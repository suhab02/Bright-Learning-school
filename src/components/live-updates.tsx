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
    let pending = false;
    let subscribedBefore = false;
    let lastRefresh = Date.now();
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (
          pending &&
          document.visibilityState === "visible" &&
          !document.querySelector('form[data-unsaved="true"]')
        ) {
          pending = false;
          lastRefresh = Date.now();
          router.refresh();
        }
      }, Math.max(500, 5000 - (Date.now() - lastRefresh)));
    };
    const changed = () => {
      pending = true;
      schedule();
    };
    const returned = () => {
      // Focus and visibility fire together. Reconcile missed signals only when stale.
      if (pending || Date.now() - lastRefresh >= 30000) changed();
    };
    const saved = () => {
      // Server actions already revalidate the layout and return fresh page data.
      // Cancel the duplicate refresh queued by this same write's Realtime signal.
      pending = false;
      lastRefresh = Date.now();
      clearTimeout(timer);
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
          changed,
        );
      }
    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        if (subscribedBefore) changed();
        subscribedBefore = true;
      }
    });
    document.addEventListener("input", edited, true);
    document.addEventListener("change", edited, true);
    document.addEventListener("visibilitychange", returned);
    window.addEventListener("focus", returned);
    window.addEventListener("school:saved", saved);
    return () => {
      clearTimeout(timer);
      void db.removeChannel(channel);
      document.removeEventListener("input", edited, true);
      document.removeEventListener("change", edited, true);
      document.removeEventListener("visibilitychange", returned);
      window.removeEventListener("focus", returned);
      window.removeEventListener("school:saved", saved);
    };
  }, [router, schoolId]);
  return null;
}
