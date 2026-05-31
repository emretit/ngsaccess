import { Link, useLocation } from "react-router-dom";
import {
  Users,
  Dices,
  Shield,
  ShieldCheck,
  DoorOpen,
  Activity,
  FileText,
  CalendarClock,
  Palmtree,
  Settings,
  ClipboardList,
} from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/AuthProvider";

interface NavItem {
  name: string;
  href: string;
  icon: typeof Users;
  adminOnly?: boolean;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: "Kişiler", href: "/employees", icon: Users },
  { name: "Cihazlar", href: "/devices", icon: Dices },
  { name: "Geçiş Kontrol", href: "/access-control", icon: Shield },
  { name: "Ziyaretçiler", href: "/visitors", icon: DoorOpen },
  { name: "Canlı İzleme", href: "/live-monitoring", icon: Activity },
  { name: "PDKS Kayıtları", href: "/pdks-records", icon: FileText },
  { name: "Vardiyalar", href: "/shifts", icon: CalendarClock },
  { name: "İzinler", href: "/leaves", icon: Palmtree },
  { name: "Denetim Kaydı", href: "/audit-log", icon: ClipboardList, adminOnly: true },
  { name: "Admin", href: "/system-admin", icon: ShieldCheck, superAdminOnly: true },
  { name: "Ayarlar", href: "/settings", icon: Settings },
];

export function AppSidebarNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin";
  const isAdmin = isSuperAdmin || profile?.role === "project_admin";

  return (
    <SidebarMenu>
      {navItems
        .filter((item) => (!item.adminOnly || isAdmin) && (!item.superAdminOnly || isSuperAdmin))
        .map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.href;

        return (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.name}
              className={
                isActive
                  ? "bg-white/20! text-white! hover:bg-white/30! hover:text-white!"
                  : undefined
              }
            >
              <Link to={item.href}>
                <Icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
