"use client";
import { Button } from "./ui";
export function ReportTools({
  locale,
  csv,
  filename,
}: {
  locale: "bn" | "en";
  csv?: string;
  filename: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      <Button variant="secondary" onClick={() => window.print()}>
        {locale === "bn" ? "প্রিন্ট করুন" : "Print"}
      </Button>
      {csv !== undefined && (
        <Button
          variant="secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {locale === "bn" ? "CSV ডাউনলোড" : "Download CSV"}
        </Button>
      )}
    </div>
  );
}
