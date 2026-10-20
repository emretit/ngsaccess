import { Link } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { AppSidebarNav } from "./AppSidebarNav";


export function AppSidebar() {
  return (
    <Sidebar collapsible="none" side="left">
      <SidebarHeader>
        <Link
          to="/home"
          className="flex h-full w-full items-center gap-2 text-sidebar-foreground"
        >
          {/* Koyu bordo kenar çubuğunda marka kuralı: beyaz logo. */}
          <img src="/branding/logo-small-white.svg" alt="" width={32} height={32} className="h-8 w-8 shrink-0 object-contain" />
          <span className="truncate text-[19px] font-semibold group-data-[collapsible=icon]:hidden text-white">
            NGS Plus
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <AppSidebarNav />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-1 px-6 py-6">
        <p className="text-[11px] text-side-muted truncate group-data-[collapsible=icon]:hidden">
          Personel ve geçiş yönetimi
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
