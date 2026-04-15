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
      <SidebarHeader>
        <Link
          to="/home"
          className="flex h-full w-full items-center gap-2 text-sidebar-foreground"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/20 text-white font-bold text-xs">
            P
          </div>
          <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden text-white">
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

      <SidebarFooter className="border-t border-sidebar-border">
        <p className="text-xs text-white/80 truncate group-data-[collapsible=icon]:hidden">
          PDKS v1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
