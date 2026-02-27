import { Link, useLocation } from "react-router-dom";
import { Users, Dices, Shield, FileText, CalendarClock, Palmtree, UserCircle, Settings } from "lucide-react";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const navItems = [
  { name: "Kişiler", href: "/employees", icon: Users },
  { name: "Cihazlar", href: "/devices", icon: Dices },
  { name: "Geçiş Kontrol", href: "/access-control", icon: Shield },
  { name: "PDKS Kayıtları", href: "/pdks-records", icon: FileText },
  { name: "Vardiyalar", href: "/shifts", icon: CalendarClock },
  { name: "İzinler", href: "/leaves", icon: Palmtree },
  { name: "Çalışan Portalı", href: "/employee-portal", icon: UserCircle },
  { name: "Ayarlar", href: "/settings", icon: Settings },
];

export function AppSidebarNav() {
  const location = useLocation();

  return (
    <SidebarMenu>
      {navItems.map((item) => {
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
                  ? "!bg-white/20 !text-white hover:!bg-white/30 hover:!text-white"
                  : undefined
              }
            >
              <Link to={item.href}>
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
