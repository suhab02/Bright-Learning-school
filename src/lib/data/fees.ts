import "server-only";
import { supabaseServer } from "../supabase/server";
import type { DirectoryRow } from "./students";

export type FeeCategory = { id: string; name_en: string; name_bn: string; frequency: "monthly" | "one_time" | "annual"; sort_order: number; is_active: boolean };
export type ClassOption = { id: string; name_en: string; name_bn: string; sort_order: number };

export async function getFeeSetup(schoolId: string) {
  const supabase = await supabaseServer();
  const [{ data: cats }, { data: classes }, { data: year }] = await Promise.all([
    supabase.from("fee_categories").select("id,name_en,name_bn,frequency,sort_order,is_active").eq("school_id", schoolId).order("sort_order"),
    supabase.from("classes").select("id,name_en,name_bn,sort_order").eq("school_id", schoolId).eq("is_active", true).order("sort_order"),
    supabase.from("academic_years").select("id,name").eq("school_id", schoolId).eq("is_current", true).maybeSingle(),
  ]);
  const { data: rates } = year
    ? await supabase.from("fee_structures").select("fee_category_id,class_id,amount").eq("academic_year_id", year.id)
    : { data: [] };
  const rateMap: Record<string, Record<string, number>> = {};
  for (const r of rates ?? []) {
    if (!r.class_id) continue;
    (rateMap[r.fee_category_id] ??= {})[r.class_id] = Number(r.amount);
  }
  return { categories: (cats ?? []) as FeeCategory[], classes: (classes ?? []) as ClassOption[], year, rateMap };
}

export type Balance = { student_id: string; billed: number; discounts: number; paid: number; outstanding: number; overdue: number; oldest_due: string | null };

export async function getDueStudents(limit = 50) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("student_fee_balances").select("*").gt("outstanding", 0)
    .order("outstanding", { ascending: false }).limit(limit);
  const balances = (data ?? []) as Balance[];
  if (!balances.length) return [];
  const { data: people } = await supabase.from("student_directory").select("*").in("id", balances.map((b) => b.student_id));
  const byId = new Map(((people ?? []) as DirectoryRow[]).map((p) => [p.id, p]));
  return balances.filter((b) => byId.has(b.student_id)).map((b) => ({ ...b, student: byId.get(b.student_id)! }));
}

export type ChargeRow = {
  item_id: string; fee_category_id: string; category_en: string; category_bn: string; description: string | null;
  billing_period: string | null; due_on: string; amount: number; adjusted: number; paid: number; outstanding: number; status: string;
};
export type PaymentRow = {
  id: string; receipt_no: string; amount: number; method: string; reference: string | null; verification_status: string;
  paid_on: string; paid_at: string; status: string; student_id: string;
};

export async function getStudentLedger(studentId: string) {
  const supabase = await supabaseServer();
  const [{ data: items }, { data: bal }, { data: payments }, credit] = await Promise.all([
    supabase.from("invoice_items").select("id, description, fee_category_id, fee_categories(name_en, name_bn)").eq("student_id", studentId),
    supabase.from("invoice_item_balances").select("*").eq("student_id", studentId),
    supabase.from("payments").select("id,receipt_no,amount,method,reference,verification_status,paid_on,paid_at,status,student_id")
      .eq("student_id", studentId).order("paid_at", { ascending: false }),
    supabase.rpc("student_credit", { p_student: studentId }),
  ]);
  type I = { id: string; description: string | null; fee_category_id: string; fee_categories: { name_en: string; name_bn: string } };
  const meta = new Map(((items ?? []) as unknown as I[]).map((i) => [i.id, i]));
  const charges: ChargeRow[] = ((bal ?? []) as Record<string, unknown>[]).map((b) => {
    const m = meta.get(b.item_id as string);
    return {
      item_id: b.item_id as string, fee_category_id: b.fee_category_id as string,
      category_en: m?.fee_categories.name_en ?? "", category_bn: m?.fee_categories.name_bn ?? "",
      description: m?.description ?? null, billing_period: b.billing_period as string | null, due_on: b.due_on as string,
      amount: Number(b.amount), adjusted: Number(b.adjusted), paid: Number(b.paid), outstanding: Number(b.outstanding),
      status: b.status as string,
    };
  }).sort((a, b) => a.due_on.localeCompare(b.due_on));
  const open = charges.filter((c) => c.status === "active");
  return {
    charges,
    payments: (payments ?? []) as PaymentRow[],
    credit: credit.error ? 0 : Number(credit.data ?? 0),
    due: open.reduce((s, c) => s + c.outstanding, 0),
  };
}

export async function getReceipt(paymentId: string) {
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("payments")
    .select("id,receipt_no,amount,method,reference,verification_status,paid_on,paid_at,status,student_id,collected_by,note")
    .eq("id", paymentId).maybeSingle();
  if (!p) return null;
  const [{ data: allocs }, { data: student }, { data: reversal }, collector, ledger] = await Promise.all([
    supabase.from("payment_allocations").select("amount, invoice_items(description, billing_period, fee_categories(name_en, name_bn))").eq("payment_id", paymentId),
    supabase.from("student_directory").select("*").eq("id", p.student_id).maybeSingle(),
    supabase.from("payment_reversals").select("reason, reversed_at").eq("payment_id", paymentId).maybeSingle(),
    supabase.rpc("staff_name", { p_user: p.collected_by }),
    supabase.from("student_fee_balances").select("outstanding").eq("student_id", p.student_id).maybeSingle(),
  ]);
  type A = { amount: number; invoice_items: { description: string | null; billing_period: string | null; fee_categories: { name_en: string; name_bn: string } } };
  const lines = ((allocs ?? []) as unknown as A[]).map((a) => ({
    amount: Number(a.amount), description: a.invoice_items?.description ?? null, period: a.invoice_items?.billing_period ?? null,
    name_en: a.invoice_items?.fee_categories?.name_en ?? "", name_bn: a.invoice_items?.fee_categories?.name_bn ?? "",
  }));
  const allocated = lines.reduce((s, l) => s + l.amount, 0);
  return {
    payment: { ...p, amount: Number(p.amount) } as PaymentRow & { collected_by: string; note: string | null },
    lines, advance: Math.max(0, Number(p.amount) - allocated),
    student: student as DirectoryRow | null, reversal, collector: collector.error ? null : (collector.data as string | null),
    stillDue: Number(ledger.data?.outstanding ?? 0),
  };
}

export async function listPayments(from: string, to: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("payments")
    .select("id,receipt_no,amount,method,reference,verification_status,paid_on,paid_at,status,student_id")
    .gte("paid_on", from).lte("paid_on", to).order("paid_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as PaymentRow[];
  const ids = [...new Set(rows.map((r) => r.student_id))];
  const { data: people } = ids.length ? await supabase.from("student_directory").select("*").in("id", ids) : { data: [] };
  const byId = new Map(((people ?? []) as DirectoryRow[]).map((x) => [x.id, x]));
  return rows.map((r) => ({ ...r, amount: Number(r.amount), student: byId.get(r.student_id) ?? null }));
}

/** "2026-10-01" → "October 2026" / "অক্টোবর ২০২৬" */
export function periodLabel(period: string | null, locale: "bn" | "en") {
  if (!period) return null;
  return new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(period + "T00:00:00Z"));
}
