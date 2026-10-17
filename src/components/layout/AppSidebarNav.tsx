import { Link, useLocation } from "react-router-dom";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { visibleRoutes } from "@/lib/routeMeta";

export function AppSidebarNav() {
  const location = useLocation();
  const { profile } = useAuth();
  const { isMobile, setOpenMobile } = useSidebar();
  const routes = visibleRoutes(profile?.role);
  return <nav aria-label="Ana menü" className="space-y-4">
    {(["main", "attendance", "management"] as const).map(group => {
      const items = routes.filter(item => item.group === group);
      if (!items.length) return null;
      return <SidebarMenu key={group} className="gap-[3px]">{items.map(item => {
        const active = location.pathname === item.href || location.pathname.startsWith(`${item.href}/`);
        return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active} tooltip={item.name}>
          <Link to={item.href} aria-current={active ? "page" : undefined} onClick={() => { if (isMobile) setOpenMobile(false); }}>
            <item.icon className="h-4 w-4 text-side-muted" aria-hidden="true" /><span>{item.name}</span>
          </Link>
        </SidebarMenuButton></SidebarMenuItem>;
      })}</SidebarMenu>;
    })}
  </nav>;
}
