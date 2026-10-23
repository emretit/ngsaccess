import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { AppSidebarNav } from "./AppSidebarNav";
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: "admin" } }) }));
vi.mock("@/components/ui/sidebar", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { SidebarMenu: Part, SidebarMenuItem: Part, SidebarMenuButton: Part, SidebarMenuSub: Part, SidebarMenuSubItem: Part, SidebarMenuSubButton: Part, useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }) };
});
it("sanal okuyucular ayrı menüde değil, Cihazlar içinde", () => {
  const html = renderToStaticMarkup(<MemoryRouter><AppSidebarNav /></MemoryRouter>);
  expect(html).toContain('href="/devices"');
  expect(html).not.toContain('href="/virtual-readers"');
  expect(html).not.toContain("Yakında");
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "admin", loading: false }) }));
