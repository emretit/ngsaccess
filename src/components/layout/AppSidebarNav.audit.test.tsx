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
it("keeps the destination and upcoming badge on one line, with space reserved for the full badge", () => {
  const html = renderToStaticMarkup(<MemoryRouter><AppSidebarNav /></MemoryRouter>);
  const link = html.match(/<a[^>]*href="\/virtual-readers"[^>]*>[\s\S]*?<\/a>/)?.[0];
  expect(link).toContain('class="min-w-0 flex-1 whitespace-nowrap">Sanal Okuyucular</span>');
  expect(link).toMatch(/class="[^"]*shrink-0 whitespace-nowrap[^"]*">Yakında<\/span>/);
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "admin", loading: false }) }));
