"use client";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, Newspaper } from "lucide-react";
import { facebookPageUrl, facebookFeedUrl, facebookPostUrl } from "@/lib/facebook/page-url";

type PostPreview = { url: string; text: string; date: string; savedAt: string };
export function FacebookUpdates({ pageUrl, locale, schoolName, postPreview }: {
  pageUrl: string | null; locale: "en" | "bn"; schoolName: string; postPreview?: PostPreview | null;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const page = facebookPageUrl(pageUrl);
  const post = facebookPostUrl(postPreview?.url, page);
  const L = (en: string, bn: string) => locale === "bn" ? bn : en;
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const height = 340;
  const src = page && width ? post
    ? "https://www.facebook.com/plugins/post.php?" + new URLSearchParams({ href: post, width: String(Math.max(180, Math.min(500, width))), show_text: "true" })
    : facebookFeedUrl(page, width, height) : null;
  return (
    <section aria-label={L("School Facebook post", "স্কুলের ফেসবুক পোস্ট")} className="overflow-hidden rounded-[24px] border border-line bg-surface card-shadow">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1877f2] text-white"><Newspaper aria-hidden="true" className="size-4" /></span>
          <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{L("From our Facebook Page", "আমাদের ফেসবুক পেজ থেকে")}</h2><p className="truncate text-[11px] text-ink-2">{schoolName}</p></div>
        </div>
        {page && <a href={post || page} target="_blank" rel="noreferrer" aria-label={L("Open on Facebook", "ফেসবুকে খুলুন")} className="grid size-11 shrink-0 place-items-center rounded-full text-brand hover:bg-surface-2"><ExternalLink aria-hidden="true" className="size-4" /></a>}
      </header>
      <div ref={frame} className="h-[340px] w-full overflow-hidden bg-white">
        {src && width ? <iframe key={src} title={L("School Facebook post", "স্কুলের ফেসবুক পোস্ট")} src={src} width={width} height={height} loading="lazy" className="block h-full w-full border-0" allow="encrypted-media; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" /> : <p className="p-4 text-sm text-ink-2">{page ? L("Loading Facebook…", "ফেসবুক লোড হচ্ছে…") : L("The school Facebook Page has not been added yet.", "স্কুলের ফেসবুক পেজ এখনো যোগ করা হয়নি।")}</p>}
      </div>
      {page && <footer className="flex items-center justify-between gap-3 border-t border-line px-4 py-2">
        <p className="text-[11px] leading-relaxed text-ink-2">{L("Post unavailable? Open it on Facebook.", "পোস্ট দেখা যাচ্ছে না? ফেসবুকে খুলুন।")}</p>
        <a href={post || page} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-xs font-semibold text-brand">{L("View post", "পোস্ট দেখুন")}<ExternalLink aria-hidden="true" className="size-3.5" /></a>
      </footer>}
    </section>
  );
}
