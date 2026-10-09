import "server-only";
import { cache } from "react";
import { supabaseServer } from "../supabase/server";
import type { AttendanceRow } from "../attendance/shared";

export async function attendanceRoster(section: string, date: string): Promise<AttendanceRow[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("attendance_roster", { p_section: section, p_date: date });
  if (error) throw error;
  return data ?? [];
}
export const schoolToday = cache(async (schoolId: string): Promise<string> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("local_today", { p_school: schoolId });
  if (error || !data) throw error ?? new Error("School date unavailable");
  return data;
});
