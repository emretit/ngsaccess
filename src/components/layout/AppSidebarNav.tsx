import { Link, useLocation } from "react-router-dom";
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar } from "@/components/ui/sidebar";
import { usePermissions } from "@/hooks/usePermissions";
import { visibleRoutes } from "@/lib/routeMeta";
import { REPORT_GROUPS, REPORTS_BASE_PATH, reportGroupPath } from "@/lib/reports/groups";

const isUnder = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

export function AppSidebarNav() {
  const location = useLocation();
  const { role, can } = usePermissions();
  const { isMobile, setOpenMobile } = useSidebar();
  const routes = visibleRoutes(role ?? undefined, false, can);
  const closeMobile = () => { if (isMobile) setOpenMobile(false); };
  return <nav aria-label="Ana menü" className="space-y-4">
    {(["main", "attendance", "management"] as const).map(group => {
      const items = routes.filter(item => item.group === group);
      if (!items.length) return null;
      return <SidebarMenu key={group} className="gap-[3px]">{items.map(item => {
        const active = isUnder(location.pathname, item.href);
        // Raporlar alt grupları yalnız modül açıkken görünür; ikon modunda SidebarMenuSub zaten gizlenir.
        const showReportGroups = item.href === REPORTS_BASE_PATH && active;
        return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active} tooltip={item.name} className={item.badge ? "gap-2 px-2" : undefined}>
          <Link to={item.href} aria-current={location.pathname === item.href ? "page" : undefined} onClick={closeMobile}>
            <item.icon className="h-4 w-4 text-side-muted" aria-hidden="true" /><span className="min-w-0 flex-1 whitespace-nowrap">{item.name}</span>{item.badge && <span className="ml-auto shrink-0 whitespace-nowrap rounded border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground group-data-[collapsible=icon]:hidden">{item.badge}</span>}
          </Link>
        </SidebarMenuButton>
        {showReportGroups && <SidebarMenuSub aria-label={`${item.name} grupları`}>{REPORT_GROUPS.map(reportGroup => {
          const href = reportGroupPath(reportGroup.key);
          const subActive = isUnder(location.pathname, href);
          return <SidebarMenuSubItem key={reportGroup.key}><SidebarMenuSubButton asChild isActive={subActive}>
            <Link to={href} aria-current={subActive ? "page" : undefined} onClick={closeMobile}><span>{reportGroup.label}</span></Link>
          </SidebarMenuSubButton></SidebarMenuSubItem>;
        })}</SidebarMenuSub>}
        </SidebarMenuItem>;
      })}</SidebarMenu>;
    })}
  </nav>;
}
