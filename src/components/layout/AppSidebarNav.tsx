import { capabilities } from "@/lib/capabilities";
import { Link, useLocation } from "react-router-dom";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/AuthProvider";

import { routeMeta } from "@/lib/routeMeta";

export function AppSidebarNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const { systemAdmin: isSuperAdmin, admin: isAdmin } = capabilities(profile?.role);

  return (
    <SidebarMenu>
      {routeMeta
        .filter((item) => (item.menu !== false) && (!item.adminOnly || isAdmin) && (!item.superAdminOnly || isSuperAdmin))
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
              <Link to={item.href} aria-current={isActive ? "page" : undefined}>
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
