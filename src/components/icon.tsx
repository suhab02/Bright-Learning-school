import {
  LayoutDashboard, GraduationCap, Users, UserRound, CalendarCheck, School, NotebookPen, ClipboardList,
  Wallet, Receipt, HandCoins, ChartColumn, Megaphone, ShieldCheck, Settings, LifeBuoy, House, Share2, type LucideIcon,
} from "lucide-react";

const map: Record<string, LucideIcon> = {
  LayoutDashboard, GraduationCap, Users, UserRound, CalendarCheck, School, NotebookPen, ClipboardList,
  Wallet, Receipt, HandCoins, ChartColumn, Megaphone, ShieldCheck, Settings, LifeBuoy, House, Share2,
};
export function NavIcon({ name, className }: { name: string; className?: string }) {
  const I = map[name] ?? LayoutDashboard;
  return <I className={className} aria-hidden />;
}
