"use client";
import { useActionState, useRef, useState } from "react";
import { Button,Textarea,Input,Notice } from "@/components/ui";
import { facebookAction, type FacebookActionState } from "./actions";
const initial:FacebookActionState={};
export function FacebookForm({op,locale,connected=true,target,postId,pages,initialText=""}:{op:"select"|"disconnect"|"publish"|"comment"|"message";locale:"en"|"bn";connected?:boolean;target?:string;postId?:string;pages?:{id:string;name:string}[];initialText?:string}) {
  const ref=useRef<HTMLFormElement>(null);
  const [text,setText]=useState(initialText); const [copied,setCopied]=useState(false);
  const [state,action,pending]=useActionState(async(previous:FacebookActionState,data:FormData)=>{const result=await facebookAction(previous,data);if(result.ok){ref.current?.reset();setText("");}return result;},initial);
  const L=(en:string,bn:string)=>locale==="bn"?bn:en;
  const errors:Record<string,string>={reconnect:L("Please reconnect your Facebook Page.","ফেসবুক পেজ আবার সংযুক্ত করুন।"),permissions:L("Meta has not granted the required permission. Complete Meta setup or review.","Meta প্রয়োজনীয় অনুমতি দেয়নি। Meta সেটআপ বা রিভিউ সম্পূর্ণ করুন।"),window:L("This conversation is outside the 24-hour reply window. Use Meta Business Suite.","এই কথোপকথনের ২৪ ঘণ্টার উত্তর দেওয়ার সময় শেষ হয়েছে। Meta Business Suite ব্যবহার করুন।"),confirmation:L("Confirm the destination before sending.","পাঠানোর আগে গন্তব্য নিশ্চিত করুন।"),facebook_admin_only:L("Only school admins can use this feature.","শুধু স্কুল অ্যাডমিন এই সুবিধা ব্যবহার করতে পারেন।")};
  return <form ref={ref} action={action} className="space-y-3">
    <input type="hidden" name="op" value={op} />{target&&<input type="hidden" name="target" value={target} />}{postId&&<input type="hidden" name="postId" value={postId} />}
    {op==="select"?<label className="block space-y-2 text-sm font-semibold"><span>{L("Choose your school Page","স্কুলের পেজ বেছে নিন")}</span><select name="pageId" required className="h-12 w-full rounded-xl border border-line bg-surface px-3">{pages?.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>:op!=="disconnect"?<>
      <label className="block space-y-2 text-sm font-semibold"><span>{op==="publish"?L("Post text","পোস্টের লেখা"):L("Your reply","আপনার উত্তর")}</span><Textarea name="text" required maxLength={op==="message"?2000:5000} rows={op==="publish"?5:3} value={text} onChange={e=>{setText(e.target.value);setCopied(false);}} placeholder={L("Write in Bangla or English…","বাংলা বা ইংরেজিতে লিখুন…")} /></label>
      {text&&<div className="rounded-2xl border border-line bg-surface-2 p-4"><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-2">{L("Preview","প্রিভিউ")}</p><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p></div>}
      {connected&&<label className="flex items-start gap-2 text-xs leading-relaxed text-ink-2"><Input type="checkbox" name="confirm" value="yes" required className="mt-0.5 size-4 shrink-0" /><span>{op==="publish"?L("Publish this text publicly on the connected Page.","এই লেখা সংযুক্ত পেজে সবার জন্য প্রকাশ করুন।"):L("Send this reply to the conversation shown above.","উপরে দেখানো কথোপকথনে এই উত্তর পাঠান।")}</span></label>}
    </>:null}
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending||!connected} variant={op==="disconnect"?"secondary":"primary"}>{pending?L("Working…","অপেক্ষা করুন…"):op==="select"?L("Connect this Page","এই পেজ সংযুক্ত করুন"):op==="disconnect"?L("Disconnect","সংযোগ বিচ্ছিন্ন করুন"):op==="publish"?L("Publish to Facebook","ফেসবুকে প্রকাশ করুন"):L("Send reply","উত্তর পাঠান")}</Button>{op==="publish"&&<Button type="button" variant="secondary" disabled={!text} onClick={async()=>{try{await navigator.clipboard.writeText(text);setCopied(true);}catch{setCopied(false);}}}>{copied?L("Copied","কপি হয়েছে"):L("Copy text","লেখা কপি করুন")}</Button>}</div>
    {state.ok&&<Notice tone="success">{state.ok==="sent"?L("Facebook confirmed your post or reply.","ফেসবুক আপনার পোস্ট বা উত্তর নিশ্চিত করেছে।"):state.ok==="disconnected"?L("Disconnected on this device.","এই ডিভাইসের সংযোগ বিচ্ছিন্ন হয়েছে।"):L("Page connected on this device.","এই ডিভাইসে পেজ সংযুক্ত হয়েছে।")}</Notice>}
    {state.error&&<Notice tone="error">{errors[state.error]||L("Could not confirm the action. Check Facebook before retrying.","কাজটি নিশ্চিত করা যায়নি। আবার চেষ্টা করার আগে ফেসবুকে দেখুন।")}</Notice>}
  </form>;
}
