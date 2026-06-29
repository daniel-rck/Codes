import { Clock, QrCode, ScanLine } from "lucide-react";
import { Outlet } from "react-router-dom";
import { ROUTES } from "./lib/routes.ts";
import { AppShell, type NavItem } from "./lib/ui/index.ts";

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.scan, label: "Scannen", icon: <ScanLine size={20} aria-hidden /> },
  { to: ROUTES.generate, label: "Erstellen", icon: <QrCode size={20} aria-hidden /> },
  { to: ROUTES.history, label: "Verlauf", icon: <Clock size={20} aria-hidden /> },
];

export function AppLayout() {
  return (
    <AppShell title="codes" logo={<QrCode size={22} aria-hidden />} navItems={NAV_ITEMS}>
      <Outlet />
    </AppShell>
  );
}
