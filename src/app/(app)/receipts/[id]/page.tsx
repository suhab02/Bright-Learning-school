import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { can, requireContext } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { getSchool, schoolPlace } from "@/lib/data/school";
import { getReceipt, periodLabel } from "@/lib/data/fees";
import { className, displayName } from "@/lib/data/students";
import { formatDate, formatNumber, formatTaka, toBnDigits } from "@/lib/format";
import { Notice, Skeleton } from "@/components/ui";
import { PrintButton, ReverseForm } from "./receipt-actions";

export const metadata = { title: "Receipt" };

async function ReceiptView({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = await requireContext();
  const [{ id }, sp, { locale, t }, school] = await Promise.all([params, searchParams, getT(), getSchool(ctx.schoolId)]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const r = await getReceipt(id);
  if (!r) notFound();
  const f = t.fees;
  const bn = { bnDigits: locale === "bn" && school.use_bengali_digits };
  const money = (v: number) => formatTaka(v, bn);
  const digits = (v: string) => (bn.bnDigits ? toBnDigits(v) : v);
  const p = r.payment;
  const reversed = p.status === "reversed";
  const st = r.student;
  const back = ctx.role === "guardian" ? "/portal/fees" : `/fees/student/${p.student_id}`;
  const rows: [string, string][] = [
    [f.receiptNo, digits(p.receipt_no)],
    [f.date, formatDate(p.paid_at, locale, bn)],
    ...(st ? [
      [f.student, displayName(st, locale)] as [string, string],
      [f.studentId, digits(st.student_code)] as [string, string],
      [f.classRoll, [className(st, locale), st.roll_no ? formatNumber(st.roll_no, bn) : null].filter(Boolean).join(" / ")] as [string, string],
    ] : []),
  ];

  return (
    <div>
      <div className="no-print mb-4 flex items-center gap-3">
        <Link href={back} aria-label={f.back} className="press grid size-11 place-items-center rounded-2xl bg-surface card-shadow"><ChevronLeft className="size-5" /></Link>
        <h1 className="text-[26px] font-bold tracking-tight">{f.receipt}</h1>
      </div>
      {sp.new && !reversed && <Notice tone="success" className="no-print mb-4">{f.paymentSaved}</Notice>}
      {reversed && <Notice tone="error" className="no-print mb-4">{f.reversedNotice}{r.reversal?.reason ? ` — ${r.reversal.reason}` : ""}</Notice>}

      <article className="print-sheet relative overflow-hidden rounded-[22px] bg-surface card-shadow">
        <header className="brand-band px-5 pb-5 pt-5 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={school.logoUrl} alt="" className="mx-auto size-16 rounded-2xl bg-white object-contain p-1" />
          <h2 className="mt-2 text-xl font-bold leading-tight">{locale === "bn" ? school.name_bn : school.name_en}</h2>
          <p className="text-[13px] text-white/80">{[school.address_line, schoolPlace(school)].filter(Boolean).join(", ")}</p>
          {school.phone && <p className="num text-[13px] text-white/80">{digits(school.phone)}</p>}
          {school.receipt_header && <p className="mt-1 text-[13px] text-white/90">{school.receipt_header}</p>}
        </header>
        <div className="px-5 py-4">
          <p className="text-center text-[17px] font-bold">{f.receipt}</p>
          <div className="stitch mx-auto my-3 w-32 text-sun" aria-hidden />
          <dl className="flex flex-col gap-1.5 text-[14px]">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4"><dt className="text-ink-2">{k}</dt><dd className="num text-right font-semibold">{v}</dd></div>
            ))}
          </dl>

          <div className="mt-4 rounded-2xl bg-surface-2 p-3">
            <p className="mb-2 text-[13px] font-semibold text-ink-2">{f.items}</p>
            <ul className="flex flex-col gap-1.5 text-[14px]">
              {r.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>{[locale === "bn" ? l.name_bn : l.name_en, periodLabel(l.period, locale) ?? l.description].filter(Boolean).join(" · ")}</span>
                  <span className="num font-semibold">{money(l.amount)}</span>
                </li>
              ))}
              {r.advance > 0 && (
                <li className="flex justify-between gap-3"><span>{f.advanceKept}</span><span className="num font-semibold">{money(r.advance)}</span></li>
              )}
            </ul>
          </div>

          <div className="mt-4 flex items-end justify-between gap-3">
            <span className="text-ink-2">{f.total}</span>
            <span className="num text-[28px] font-bold leading-none">{money(p.amount)}</span>
          </div>
          <dl className="mt-3 flex flex-col gap-1.5 text-[14px]">
            <div className="flex justify-between gap-4"><dt className="text-ink-2">{f.method}</dt><dd className="font-semibold">{f.methods[p.method as keyof typeof f.methods]}{p.reference ? ` · ${p.reference}` : ""}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-ink-2">{f.balanceAfter}</dt><dd className="num font-semibold">{money(r.stillDue)}</dd></div>
            {r.collector && <div className="flex justify-between gap-4"><dt className="text-ink-2">{f.receivedBy}</dt><dd className="font-semibold">{r.collector}</dd></div>}
          </dl>
          {p.verification_status === "unverified" && <p className="mt-3 rounded-xl tint-amber px-3 py-2 text-xs font-medium">{f.unverified}</p>}
          <p className="mt-4 text-center text-xs text-ink-2">{f.thanks} · {f.computerReceipt}</p>
        </div>
        {reversed && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="-rotate-12 rounded-2xl border-4 border-danger px-6 py-2 text-3xl font-black uppercase tracking-widest text-danger/80">{f.reversed}</span>
          </div>
        )}
      </article>

      <div className="no-print mt-4 flex flex-col gap-3">
        <PrintButton />
        {!reversed && can(ctx, "fees.reverse") && <ReverseForm paymentId={p.id} />}
      </div>
    </div>
  );
}

export default function Page({ params, searchParams }: PageProps<"/receipts/[id]">) {
  return <Suspense fallback={<Skeleton className="h-[560px]" />}><ReceiptView params={params} searchParams={searchParams} /></Suspense>;
}
