export const STATUSES = ["present", "absent", "late", "excused"] as const;
export type AttendanceStatus = typeof STATUSES[number];
export type AttendanceRow = {
  student_id: string; full_name_en: string; full_name_bn: string | null;
  student_code: string; roll_no: number | null; status: AttendanceStatus | null;
  note: string | null; marked_at: string | null;
};
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function monthRange(value: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || !validDate(`${value}-01`)) return null;
  const [year, month] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { start: `${value}-01`, end };
}
