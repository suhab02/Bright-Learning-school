"use client";
import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { Button, Notice } from "./ui";

export function NoticeExport({locale,title,preview=false}:{locale:"bn"|"en";title:string;preview?:boolean}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState(false);
  const L=(en:string,bn:string)=>locale === "bn" ? bn : en;
  async function download(button:HTMLButtonElement) {
    const source=button.closest('[data-notice-export]')?.querySelector<HTMLElement>('.notice-letter');
    if(!source)return;
    setBusy(true);setError(false);
    let holder:HTMLDivElement|null=null;
    try {
      const [{toCanvas},{jsPDF}]=await Promise.all([import('html-to-image'),import('jspdf')]);
      await document.fonts.ready;
      holder=document.createElement('div');holder.style.cssText='position:fixed;left:-10000px;top:0;width:794px;background:white;';
      const clone=source.cloneNode(true) as HTMLElement;clone.classList.add('notice-export-letter');holder.append(clone);document.body.append(holder);
      await Promise.all(Array.from(clone.querySelectorAll('img')).map(img=>img.decode()));
      const canvas=await toCanvas(clone,{pixelRatio:2,backgroundColor:'#ffffff'});
      const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
      const width=182; const pageHeight=269; const sliceHeight=Math.floor(canvas.width*pageHeight/width);
      for(let top=0,page=0;top<canvas.height;top+=sliceHeight,page++) {
        if(page)pdf.addPage();
        const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(sliceHeight,canvas.height-top);
        const context=slice.getContext('2d');if(!context)throw new Error('canvas');
        context.fillStyle='white';context.fillRect(0,0,slice.width,slice.height);context.drawImage(canvas,0,top,canvas.width,slice.height,0,0,slice.width,slice.height);
        pdf.addImage(slice.toDataURL('image/png'),'PNG',14,14,width,slice.height*width/slice.width);
      }
      pdf.save(`${(title || 'School-notice').replace(/[\\/:*?"<>|]/g,'-').slice(0,80)}.pdf`);
    } catch {setError(true);} finally {holder?.remove();setBusy(false);}
  }
  function print(button:HTMLButtonElement) {
    const target=button.closest('[data-notice-export]');
    target?.classList.add('notice-print-target');
    const clean=()=>{target?.classList.remove('notice-print-target');window.removeEventListener('afterprint',clean);};
    window.addEventListener('afterprint',clean);window.print();
  }
  return <div className="no-print my-4 space-y-2"><div className="grid grid-cols-2 gap-3"><Button type="button" disabled={busy || (preview && !title.trim())} onClick={e=>download(e.currentTarget)}><Download className="size-4" />{busy?L("Preparing…","তৈরি হচ্ছে…"):L("Download PDF","PDF ডাউনলোড")}</Button><Button type="button" variant="secondary" onClick={e=>print(e.currentTarget)}><Printer className="size-4" />{L("Print","প্রিন্ট")}</Button></div>{error && <Notice tone="error">{L("PDF could not be created. Try again or use Print → Save as PDF.","PDF তৈরি করা যায়নি। আবার চেষ্টা করুন অথবা প্রিন্ট → Save as PDF ব্যবহার করুন।")}</Notice>}</div>;
}
