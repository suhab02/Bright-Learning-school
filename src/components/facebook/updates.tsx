"use client";
import { useEffect,useId,useRef,useState } from "react";
import { ExternalLink,Newspaper,X } from "lucide-react";
import { Button } from "@/components/ui";
import { facebookPageUrl,facebookFeedUrl } from "@/lib/facebook/page-url";

type PostPreview={url:string;text:string;date:string;savedAt:string};
export function FacebookUpdates({pageUrl,locale,schoolName,postPreview}:{pageUrl:string|null;locale:"en"|"bn";schoolName:string;postPreview?:PostPreview|null}) {
  const [open,setOpen]=useState(false);const url=facebookPageUrl(pageUrl);const L=(en:string,bn:string)=>locale==='bn'?bn:en;
  return <><div className="rounded-[24px] border border-line bg-surface p-5 card-shadow"><div className="mb-4 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-sky text-brand"><Newspaper className="size-6"/></span><div><h2 className="font-semibold">{L('Facebook updates','ফেসবুকের নতুন পোস্ট')}</h2><p className="mt-1 text-xs text-ink-2">{L('Recent public posts from our school','স্কুলের সাম্প্রতিক পাবলিক পোস্ট')}</p></div></div><Button type="button" className="w-full" onClick={()=>setOpen(true)}>{L('View recent posts','সাম্প্রতিক পোস্ট দেখুন')}</Button></div>{open&&<FeedPopup pageUrl={url} postPreview={postPreview} schoolName={schoolName} locale={locale} onClose={()=>setOpen(false)}/>}</>;
}
function FeedPopup({pageUrl,schoolName,locale,onClose,postPreview}:{pageUrl:string|null;schoolName:string;locale:"en"|"bn";onClose:()=>void;postPreview?:PostPreview|null}) {
  const dialog=useRef<HTMLDialogElement>(null),frame=useRef<HTMLDivElement>(null);const titleId=useId();const [size,setSize]=useState<{width:number;height:number}|null>(null);
  const L=(en:string,bn:string)=>locale==='bn'?bn:en; const [showTimeline,setShowTimeline]=useState(false);
  const preview=postPreview&&pageUrl&&typeof postPreview.date==='string'&&typeof postPreview.url==='string'&&postPreview.url.startsWith(pageUrl+'/posts/')&&typeof postPreview.text==='string'&&postPreview.text.length<=4000&&/^https:\/\/www[.]facebook[.]com\/[A-Za-z0-9.]+\/posts\/[A-Za-z0-9]+$/.test(postPreview.url)?postPreview:null;
  useEffect(()=>{
    const d=dialog.current,element=frame.current;if(!d||!element)return;
    const overflow=document.body.style.overflow;document.body.style.overflow='hidden';d.showModal();
    const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:Math.max(300,Math.min(600,window.innerHeight*.62))}));observer.observe(element);
    return ()=>{observer.disconnect();d.close();document.body.style.overflow=overflow;};
  },[]);
  const src=showTimeline&&pageUrl&&size?facebookFeedUrl(pageUrl,size.width,size.height):null;
  return <dialog ref={dialog} aria-labelledby={titleId} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_24px)] max-w-[456px] overflow-hidden rounded-[26px] border-0 bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3"><div className="min-w-0"><h2 id={titleId} className="font-semibold">{L('Recent Facebook posts','সাম্প্রতিক ফেসবুক পোস্ট')}</h2><p className="truncate text-xs text-ink-2">{schoolName}</p></div><button type="button" aria-label={L('Close posts','পোস্ট বন্ধ করুন')} onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"><X className="size-5"/></button></header>
    <div className="max-h-[calc(90dvh_-_150px)] space-y-4 overflow-y-auto px-3 py-3">
      {preview&&<article className="rounded-2xl border border-line bg-surface-2 p-4"><div className="mb-3 flex items-center gap-2"><Newspaper className="size-5 text-brand"/><span className="text-sm font-semibold">{schoolName}</span></div><time className="text-xs text-ink-2">{preview.date}</time><p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">{preview.text}</p><p className="mt-4 text-[11px] text-ink-2">{L('Saved Facebook preview · open the Page for newer posts','সংরক্ষিত ফেসবুক প্রিভিউ · নতুন পোস্টের জন্য পেজ খুলুন')}</p><a href={preview.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand">{L('View this post','এই পোস্ট দেখুন')}<ExternalLink className="size-4"/></a></article>}
      {pageUrl&&<><p className="text-xs leading-relaxed text-ink-2">{L('Facebook may require sign-in to display its live timeline here.','এখানে লাইভ টাইমলাইন দেখাতে ফেসবুকে সাইন ইন করা প্রয়োজন হতে পারে।')}</p><Button type="button" variant="secondary" className="w-full" onClick={()=>setShowTimeline(v=>!v)}>{showTimeline?L('Hide live timeline','লাইভ টাইমলাইন লুকান'):L('Show live Facebook timeline','লাইভ ফেসবুক টাইমলাইন দেখুন')}</Button></>}
      <div ref={frame} className={`${showTimeline || !pageUrl ? "min-h-40" : ""} w-full overflow-hidden rounded-xl bg-white`}>
      {src&&size?<iframe title={L('School Facebook timeline','স্কুলের ফেসবুক টাইমলাইন')} src={src} width={Math.floor(size.width)} height={Math.floor(size.height)} className="block border-0" allow="encrypted-media; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin"/>:(!pageUrl||showTimeline)?<p className="p-5 text-sm leading-relaxed text-ink-2">{pageUrl?L('Loading Facebook posts…','ফেসবুক পোস্ট লোড হচ্ছে…'):L('The school Facebook Page link has not been added yet.','স্কুলের ফেসবুক পেজের লিংক এখনো যোগ করা হয়নি।')}</p>:null}
    </div></div>
    <footer className="border-t border-line p-4"><p className="mb-2 text-xs leading-relaxed text-ink-2">{L('The live timeline is provided by Facebook. If it does not load here, open the Page below.','লাইভ টাইমলাইন ফেসবুক দেখায়। এখানে লোড না হলে নিচের লিংক থেকে পেজ খুলুন।')}</p>{pageUrl&&<a href={pageUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand">{L('Open Facebook Page','ফেসবুক পেজ খুলুন')}<ExternalLink className="size-4"/></a>}</footer>
  </dialog>;
}
