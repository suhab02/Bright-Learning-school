"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatTaka } from "@/lib/format";
import { useT } from "@/lib/i18n/client";

export type MonthPoint = { label: string; collected: number; expenses: number };

/** Two series, one axis, fixed colour per entity, legend + hidden table for screen readers. */
export function IncomeExpenseChart({ data, bnDigits }: { data: MonthPoint[]; bnDigits: boolean }) {
  const { t } = useT();
  const fmt = (v: number) => formatTaka(v, { bnDigits });
  const short = (v: number) => {
    const taka = v / 100;
    const s = taka >= 100000 ? `${+(taka / 100000).toFixed(1)}L` : taka >= 1000 ? `${+(taka / 1000).toFixed(1)}k` : String(taka);
    return "৳" + s;
  };
  return (
    <figure>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer>
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="0" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
            <YAxis tickFormatter={short} tickLine={false} axisLine={false} width={52} tick={{ fill: "var(--ink-2)", fontSize: 12 }} />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} formatter={(v) => fmt(Number(v))}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, color: "var(--ink)" }} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 13, color: "var(--ink-2)" }} />
            <Bar dataKey="collected" name={t.dashboard.collected} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="expenses" name={t.dashboard.expenses} fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t.dashboard.monthlyChart}</caption>
        <thead><tr><th>Month</th><th>{t.dashboard.collected}</th><th>{t.dashboard.expenses}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.label}><td>{d.label}</td><td>{fmt(d.collected)}</td><td>{fmt(d.expenses)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
