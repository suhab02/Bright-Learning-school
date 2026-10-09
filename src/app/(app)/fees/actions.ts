"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { parseTaka } from "@/lib/format";

export type FeeState = { ok: boolean; error?: string; message?: string; count?: number; values?: Record<string, string>; n?: number } | null;

const uuid = z.string().uuid();
const METHODS = ["cash", "bank", "bkash", "nagad", "rocket", "other"] as const;
const vals = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

function money(v: FormDataEntryValue | null): number | null {
  const p = parseTaka(String(v ?? "").trim());
  return p === null ? null : Number(p);
}
function fail(error: string, fd?: FormData): FeeState {
  return { ok: false, error, values: fd ? vals(fd) : undefined };
}
function dbFail(message: string, fd?: FormData): FeeState {
  if (/permission/i.test(message)) return fail("permission", fd);
  if (/reference is required/i.test(message)) return fail("reference", fd);
  if (/exceeds/i.test(message)) return fail("exceeds", fd);
  if (/no_current_year|current academic year/i.test(message)) return fail("no_current_year", fd);
  console.error("[fees] save failed:", message);
  return fail("save", fd);
}

/** Save one fee type's amounts for every class. Inputs are named amount_<classId>. */
export async function saveRates(categoryId: string, _: FeeState, fd: FormData): Promise<FeeState> {
  try { await requirePermission("fees.configure"); } catch { return fail("permission"); }
  if (!uuid.safeParse(categoryId).success) return fail("save");
  const rates: { class_id: string; amount: number | null }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("amount_")) continue;
    const classId = k.slice(7);
    if (!uuid.safeParse(classId).success) return fail("save");
    const raw = String(v).trim();
    if (raw === "") { rates.push({ class_id: classId, amount: null }); continue; }
    const amt = money(raw);
    if (amt === null || amt < 0) return fail("amount", fd);
    rates.push({ class_id: classId, amount: amt });
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_fee_rates", { p_category: categoryId, p_rates: rates });
  if (error) return dbFail(error.message, fd);
  refresh();
  return { ok: true };
}

export async function addCategory(_: FeeState, fd: FormData): Promise<FeeState> {
  let ctx;
  try { ctx = await requirePermission("fees.configure"); } catch { return fail("permission"); }
  const r = z.object({
    name_en: z.string().trim().min(2).max(80), name_bn: z.string().trim().min(1).max(80),
    frequency: z.enum(["monthly", "one_time", "annual"]),
  }).safeParse(vals(fd));
  if (!r.success) return fail("category", fd);
  const supabase = await supabaseServer();
  const { data: last } = await supabase.from("fee_categories").select("sort_order").eq("school_id", ctx.schoolId)
    .order("sort_order", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("fee_categories").insert({ school_id: ctx.schoolId, ...r.data, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return dbFail(error.message.includes("duplicate") ? "save" : error.message, fd);
  refresh();
  return { ok: true };
}

export async function billMonth(_: FeeState, fd: FormData): Promise<FeeState> {
  let ctx;
  try { ctx = await requirePermission("fees.invoice"); } catch { return fail("permission"); }
  const month = String(fd.get("month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) return fail("save");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("generate_monthly_charges", { p_school: ctx.schoolId, p_month: `${month}-01` });
  if (error) return dbFail(error.message);
  refresh();
  return { ok: true, count: Number(data ?? 0) };
}

/** Collect a payment, then open its receipt. The database decides how it is split. */
export async function collectPayment(studentId: string, _: FeeState, fd: FormData): Promise<FeeState> {
  try { await requirePermission("fees.collect"); } catch { return fail("permission"); }
  if (!uuid.safeParse(studentId).success) return fail("save");
  const amount = money(fd.get("amount"));
  if (amount === null || amount <= 0) return fail("amount", fd);
  // never assume a method: a missing value must not silently become "cash"
  const method = String(fd.get("method") ?? "");
  if (!(METHODS as readonly string[]).includes(method)) return fail("method", fd);
  const reference = String(fd.get("reference") ?? "").trim().slice(0, 80);
  if (method !== "cash" && !reference) return fail("reference", fd);
  const key = String(fd.get("idempotency_key") ?? "");
  if (!uuid.safeParse(key).success) return fail("save", fd);
  const items = fd.getAll("item").map(String).filter((x) => uuid.safeParse(x).success);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("collect_fee", {
    p_student: studentId, p_amount: amount, p_method: method, p_reference: reference || null,
    p_item_ids: items.length ? items : null, p_idempotency_key: key,
    p_note: String(fd.get("note") ?? "").trim().slice(0, 200) || null,
  });
  if (error) return dbFail(error.message, fd);
  redirect(`/receipts/${(data as { id: string }).id}?new=1`);
}

export async function addCharge(studentId: string, _: FeeState, fd: FormData): Promise<FeeState> {
  try { await requirePermission("fees.invoice"); } catch { return fail("permission"); }
  const amount = money(fd.get("amount"));
  if (amount === null || amount <= 0) return fail("amount", fd);
  const category = String(fd.get("category") ?? "");
  const due = String(fd.get("due_on") ?? "");
  if (!uuid.safeParse(category).success || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return fail("save", fd);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("add_charge", {
    p_student: studentId, p_category: category, p_amount: amount, p_due: due,
    p_period: null, p_description: String(fd.get("description") ?? "").trim().slice(0, 120) || null,
  });
  if (error) return dbFail(error.message, fd);
  refresh();
  return { ok: true, message: "chargeAdded" };
}

export async function applyDiscount(itemId: string, _: FeeState, fd: FormData): Promise<FeeState> {
  try { await requirePermission("fees.adjust"); } catch { return fail("permission"); }
  const amount = money(fd.get("amount"));
  if (amount === null || amount <= 0) return fail("amount", fd);
  const kind = String(fd.get("kind") ?? "discount");
  if (!["discount", "waiver", "scholarship"].includes(kind)) return fail("save", fd);
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 3) return fail("reason", fd);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("add_adjustment", { p_item: itemId, p_kind: kind, p_amount: amount, p_reason: reason.slice(0, 200) });
  if (error) return dbFail(error.message, fd);
  refresh();
  return { ok: true, message: "discountApplied" };
}

export async function applyAdvance(studentId: string): Promise<FeeState> {
  try { await requirePermission("fees.collect"); } catch { return fail("permission"); }
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("use_advance_credit", { p_student: studentId });
  if (error) return dbFail(error.message);
  refresh();
  return { ok: true, message: "advanceUsed" };
}

export async function reversePayment(paymentId: string, _: FeeState, fd: FormData): Promise<FeeState> {
  try { await requirePermission("fees.reverse"); } catch { return fail("permission"); }
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return fail("reason", fd);
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("reverse_payment", { p_payment: paymentId, p_reason: reason.slice(0, 300) });
  if (error) return dbFail(error.message, fd);
  refresh();
  return { ok: true };
}
