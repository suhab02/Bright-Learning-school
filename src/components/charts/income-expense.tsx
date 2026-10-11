"use client";
import { useState } from "react";
import { formatTaka } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export type MonthPoint = { label: string; collected: number; expenses: number };

/** Small native chart: no charting runtime, with tap details and an accessible data table. */
export function IncomeExpenseChart({ data, bnDigits }: { data: MonthPoint[]; bnDigits: boolean }) {
  const { t, locale } = useT();
  const [selected, setSelected] = useState<number | null>(null);
  const fmt = (v: number) => formatTaka(v, { bnDigits });
  const max = Math.max(1, ...data.flatMap(d => [d.collected, d.expenses]));
  const step = 10 ** Math.floor(Math.log10(max));
  const ceiling = Math.ceil(max / step) * step;
  const short = (v: number) => {
    const taka = v / 100;
    return "৳" + (taka >= 100000 ? `${+(taka / 100000).toFixed(1)}L` : taka >= 1000 ? `${+(taka / 1000).toFixed(1)}k` : String(+taka.toFixed(2)));
  };
  const point = selected === null ? null : data[selected];
  return <figure aria-label={t.dashboard.monthlyChart}>
    <div className="mb-3 min-h-10 text-xs leading-relaxed text-ink-2" aria-live="polite">
      {point ? <><strong>{point.label}</strong> · {t.dashboard.collected}: {fmt(point.collected)} · {t.dashboard.expenses}: {fmt(point.expenses)}</> : (locale === "bn" ? "বিস্তারিত দেখতে মাসে ট্যাপ করুন।" : "Tap a month for details.")}
    </div>
    <div className="flex gap-2">
      <div className="flex h-44 w-12 shrink-0 flex-col justify-between text-right text-[10px] text-ink-2" aria-hidden>{[ceiling, ceiling * 2 / 3, ceiling / 3, 0].map(v => <span key={v}>{short(v)}</span>)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex h-44 items-end gap-1 border-b border-line bg-[linear-gradient(to_top,var(--line)_1px,transparent_1px)] bg-[length:100%_33.333%]">
          {data.map((d, i) => <button type="button" key={`${d.label}-${i}`} onClick={() => setSelected(selected === i ? null : i)} aria-pressed={selected === i}
            aria-label={`${d.label}: ${t.dashboard.collected} ${fmt(d.collected)}, ${t.dashboard.expenses} ${fmt(d.expenses)}`}
            className="flex h-full min-w-0 flex-1 items-end justify-center gap-0.5 rounded-t-sm px-0.5 focus-visible:outline-2 focus-visible:outline-brand"
            style={{ background: selected === i ? "var(--surface-2)" : undefined }}>
            <span aria-hidden className="block w-1/2 max-w-5 rounded-t-sm" style={{ height: `${Math.max(0, d.collected) / ceiling * 100}%`, background: "var(--chart-1)" }} />
            <span aria-hidden className="block w-1/2 max-w-5 rounded-t-sm" style={{ height: `${Math.max(0, d.expenses) / ceiling * 100}%`, background: "var(--chart-2)" }} />
          </button>)}
        </div>
        <div className="mt-2 flex gap-1 text-center text-[9px] text-ink-2" aria-hidden>{data.map((d, i) => <span key={`${d.label}-${i}`} className="min-w-0 flex-1 truncate">{d.label}</span>)}</div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-ink-2" aria-hidden>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-1)]" />{t.dashboard.collected}</span>
      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--chart-2)]" />{t.dashboard.expenses}</span>
    </div>
    <table className="sr-only"><caption>{t.dashboard.monthlyChart}</caption><thead><tr><th>Month</th><th>{t.dashboard.collected}</th><th>{t.dashboard.expenses}</th></tr></thead><tbody>{data.map((d, i) => <tr key={`${d.label}-${i}`}><td>{d.label}</td><td>{fmt(d.collected)}</td><td>{fmt(d.expenses)}</td></tr>)}</tbody></table>
  </figure>;
}
