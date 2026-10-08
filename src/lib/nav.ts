import type { Dictionary } from "./i18n";
import type { Role } from "./auth";

export type NavKey = keyof Dictionary["nav"];
export type NavItem = { key: NavKey; href: string; icon: string; perms?: string[]; teacher?: boolean; ownerOnly?: boolean };

/** Visibility is a convenience only — the database enforces the real rules. */
export const STAFF_NAV: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "students", href: "/students", icon: "GraduationCap", perms: ["students.view"], teacher: true },
  { key: "guardians", href: "/guardians", icon: "Users", perms: ["guardians.manage"] },
  { key: "teachers", href: "/teachers", icon: "UserRound", perms: ["teachers.manage"] },
  { key: "attendance", href: "/attendance", icon: "CalendarCheck", perms: ["attendance.view", "attendance.create"], teacher: true },
  { key: "classes", href: "/classes", icon: "School", perms: ["academics.manage"], teacher: true },
  { key: "homework", href: "/homework", icon: "NotebookPen", perms: ["homework.manage"], teacher: true },
  { key: "exams", href: "/exams", icon: "ClipboardList", perms: ["exams.manage", "marks.enter", "results.publish"], teacher: true },
  { key: "fees", href: "/fees", icon: "Wallet", perms: ["fees.view", "fees.collect"] },
  { key: "payments", href: "/payments", icon: "Receipt", perms: ["fees.view"] },
  { key: "expenses", href: "/expenses", icon: "HandCoins", perms: ["expenses.view", "expenses.create"] },
  { key: "reports", href: "/reports", icon: "ChartColumn", perms: ["reports.view"] },
  { key: "notices", href: "/notices", icon: "Megaphone" },
  { key: "staff", href: "/staff", icon: "ShieldCheck", perms: ["staff.manage"] },
  { key: "settings", href: "/settings", icon: "Settings", perms: ["settings.manage"] },
  { key: "help", href: "/help", icon: "LifeBuoy" },
];

export const GUARDIAN_NAV: NavItem[] = [
  { key: "home", href: "/portal", icon: "House" },
  { key: "attendance", href: "/portal/attendance", icon: "CalendarCheck" },
  { key: "homework", href: "/portal/homework", icon: "NotebookPen" },
  { key: "fees", href: "/portal/fees", icon: "Wallet" },
  { key: "profile", href: "/portal/profile", icon: "UserRound" },
];

export function visibleNav(role: Role, perms: string[]): NavItem[] {
  if (role === "guardian") return GUARDIAN_NAV;
  return STAFF_NAV.filter((i) =>
    role === "super_admin" || !i.perms || i.perms.some((p) => perms.includes(p)) || (i.teacher && role === "teacher"));
}

/** Phone bottom bar: the four most-used items for this role, plus "More". */
export function bottomNav(role: Role, items: NavItem[]): NavItem[] {
  if (role === "guardian") return items;
  const pref: NavKey[] = role === "accountant" ? ["dashboard", "fees", "payments", "expenses"]
    : role === "teacher" ? ["dashboard", "attendance", "homework", "students"]
    : ["dashboard", "students", "attendance", "fees"];
  return pref.map((k) => items.find((i) => i.key === k)).filter(Boolean).slice(0, 4) as NavItem[];
}
