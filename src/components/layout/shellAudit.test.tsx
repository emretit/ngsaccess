import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { AppSidebarNav } from "./AppSidebarNav";

const state = vi.hoisted(() => ({
  projects: [{ _id: "p1", name: "Proje A" }],
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({
    projects: state.projects, activeProject: state.projects[0],
    loading: false, isSuperAdmin: false, setActiveProjectId: vi.fn(),
  }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { role: "admin", fullName: "Ada" }, signOut: vi.fn() }),
}));
vi.mock("./CommandPalette", () => ({ CommandPalette: () => null }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: ({ className }: { className: string }) => <button className={className}>Menü</button>,
  SidebarMenu: ({ children }: { children: ReactNode }) => <ul>{children}</ul>,
  SidebarMenuItem: ({ children }: { children: ReactNode }) => <li>{children}</li>,
  SidebarMenuButton: ({ children }: { children: ReactNode }) => <>{children}</>,
  SidebarMenuSub: () => null, SidebarMenuSubItem: () => null, SidebarMenuSubButton: () => null,
  useSidebar: () => ({ isMobile: false, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: ({ id, "aria-label": ariaLabel }: { id: string; "aria-label"?: string }) => <input id={id} aria-label={ariaLabel} />,
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe("Kabuk denetimi", () => {
  it("hides the breadcrumb on home and keeps it on other pages", () => {
    expect(render(<AppHeader title="Ana Sayfa" />)).not.toContain('aria-label="İçerik yolu"');
    const html = render(<AppHeader title="Cihazlar" />);
    expect(html).toContain('aria-label="İçerik yolu"');
    expect(html).toMatch(/aria-current="page"[^>]*>Cihazlar/);
    expect(html).toContain("Ana Sayfa");
  });
  it("gives the mobile menu and account buttons 44px touch targets", () => {
    const html = render(<AppHeader title="Ana Sayfa" />);
    expect(html).toMatch(/<button class="h-11 w-11[^"]*">Menü/);
    expect(html).toMatch(/<button[^>]*class="[^"]*h-11 w-11[^"]*"[^>]*aria-label="Hesap menüsü"/);
  });
  it("puts the single project name in context for screen readers", () => {
    expect(render(<ProjectSwitcher />)).toContain('<span class="sr-only">Aktif proje: </span>');
  });
  it("uses one label for the project search input", () => {
    state.projects.push({ _id: "p2", name: "Proje B" });
    const html = render(<ProjectSwitcher />);
    expect(html).toContain('<label for="project-search"');
    expect(html).toContain('id="project-search"');
    expect(html).not.toContain('aria-label="Proje ara"');
    state.projects.pop();
  });
  it("renders the upcoming destination with a neutral badge in navigation", () => {
    const html = render(<AppSidebarNav />);
    expect(html).toContain('href="/virtual-readers"');
    expect(html).toMatch(/class="[^"]*bg-subtle[^"]*text-muted-foreground[^"]*">Yakında/);
  });
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "admin", loading: false }) }));
