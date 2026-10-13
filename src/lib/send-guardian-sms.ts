"use server";
import { z } from "zod";
import { requireContext, can } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { bangladeshMobile } from "@/lib/sms";
import { schoolSmsConfig } from "@/lib/sms-config";

export type SmsResult = { status: "queued" | "failed" | "unknown"; message: string };
export async function sendGuardianSms(input: { guardianId: string; message: string; requestId: string }): Promise<SmsResult> {
  const ctx = await requireContext();
  // Read-only/manual WhatsApp access never grants permission to spend school SIM credits.
  if (ctx.role === "guardian" || !can(ctx, "guardians.manage")) return { status: "failed", message: "Only permitted school staff can send school SMS." };
  const parsed = z.object({ guardianId: z.uuid(), requestId: z.uuid(), message: z.string().trim().min(1).max(210) }).safeParse(input);
  if (!parsed.success || /\[[^\]]+\]/.test(input.message)) return { status: "failed", message: "Complete the message first (maximum 210 characters)." };
  const config = schoolSmsConfig(ctx.schoolId);
  if (!config) return { status: "failed", message: "School SMS is not configured. Ask the Super Admin to open Settings." };
  const db = await supabaseServer();
  const { data: guardian, error: guardianError } = await db.from("guardians").select("id,phone")
    .eq("id", parsed.data.guardianId).eq("school_id", ctx.schoolId).maybeSingle();
  const phone = guardian && bangladeshMobile(guardian.phone ?? "");
  if (guardianError || !guardian || !phone) return { status: "failed", message: "Save a valid Bangladesh guardian mobile number first." };
  const { data: existing, error: readError } = await db.from("guardian_sms_outbox").select("status")
    .eq("id", parsed.data.requestId).maybeSingle();
  if (readError) return { status: "failed", message: "Could not check SMS history. No message was sent." };
  if (existing) return { status: existing.status === "queued" ? "queued" : "unknown", message: existing.status === "queued" ? "Already queued. Delivery is not confirmed." : "This attempt was already recorded. Check TextBee before sending again." };
  const { count, error: rateError } = await db.from("guardian_sms_outbox").select("id", { count: "exact", head: true })
    .eq("sender_id", ctx.userId).eq("guardian_id", guardian.id).gte("created_at", new Date(Date.now() - 60000).toISOString());
  if (rateError || count) return { status: "failed", message: "Please wait one minute before another SMS to this guardian." };
  const { error: reserveError } = await db.from("guardian_sms_outbox").insert({ id: parsed.data.requestId, school_id: ctx.schoolId, guardian_id: guardian.id, sender_id: ctx.userId, message: parsed.data.message, status: "reserved" });
  if (reserveError) return { status: "unknown", message: "This attempt could not be reserved. No retry was made." };
  let status: SmsResult["status"] = "unknown", batchId: string | null = null;
  let message = "SMS status is uncertain. Check TextBee before trying again.";
  try {
    const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": config.apiKey },
      body: JSON.stringify({ deviceId: config.deviceId, recipients: [phone], message: parsed.data.message }),
      signal: AbortSignal.timeout(20000), cache: "no-store",
    });
    if (response.status >= 400 && response.status < 500) {
      status = "failed";
      message = response.status === 429 ? "TextBee's sending limit is reached. Nothing was queued." : "TextBee rejected this attempt. Check the API key and Android device in Settings.";
    } else if (response.ok) {
      const payload = await response.json();
      if (payload?.data?.success === true && typeof payload.data.smsBatchId === "string") {
        status = "queued"; batchId = payload.data.smsBatchId.slice(0,100);
        message = "Queued to the school phone. Delivery is not confirmed.";
      }
    }
  } catch { /* An interrupted request may have reached the provider. Never retry automatically. */ }
  const { error: updateError } = await db.from("guardian_sms_outbox").update({ status, provider_batch_id: batchId })
    .eq("id", parsed.data.requestId).eq("sender_id", ctx.userId).eq("school_id", ctx.schoolId);
  if (updateError) return { status: "unknown", message: "The attempt was recorded, but its status could not be saved. Check TextBee; do not resend yet." };
  return { status, message };
}
