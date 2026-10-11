"use server";
import { refresh } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

export async function markNotificationsRead(id?: string) {
  try {
    if (id) z.uuid().parse(id);
    const ctx = await requireContext();
    const db = await supabaseServer();
    let query = db.from("notifications").update({ read_at: new Date().toISOString() })
      .eq("user_id",ctx.userId).eq("school_id",ctx.schoolId).is("read_at",null);
    if (id) query = query.eq("id",id);
    const { error } = await query;
    if (error) return { ok:false };
    refresh();
    return { ok:true };
  } catch { return { ok:false }; }
}
