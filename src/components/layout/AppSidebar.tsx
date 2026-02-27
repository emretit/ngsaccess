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
    <Sidebar collapsible="icon" side="left">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          to="/home"
          className="flex h-14 md:h-16 items-center gap-2 px-3"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold text-sm">
            P
          </div>
          <span className="truncate text-base font-semibold group-data-[collapsible=icon]:hidden">
            PDKS
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

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <p className="text-xs text-muted-foreground truncate group-data-[collapsible=icon]:hidden">
          PDKS v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
