import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { VisitorFilters } from "./VisitorFilters";

vi.mock("@/components/ui/select", async original => ({
  ...await original<typeof import("@/components/ui/select")>(),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}));

it("shows a FIELD status label, all statuses and the clear action", () => {
  const html = renderToStaticMarkup(<VisitorFilters searchQuery="" onSearchChange={() => {}} statusFilter="all" onStatusFilterChange={() => {}} onClear={() => {}} />);
  expect(html).toContain("grid w-full min-w-0 gap-1 text-xs min-[761px]:w-40");
  expect(html).toMatch(/<label[^>]*>Erişim durumu<\/label>/);
  expectLabel(html, "Erişim durumu");
  expect(html).toContain("Tüm durumlar");
  expect(html).toContain("Filtreleri temizle");
  expect(html).not.toContain("w-48");
});

function expectLabel(html: string, label: string) {
  const labelTag = html.match(new RegExp(`<label[^>]*for="([^"]+)"[^>]*>${label}</label>`));
  expect(labelTag).not.toBeNull();
  const id = labelTag?.[1];
  const control = html.match(new RegExp(`<(?:button|input|select)[^>]*id="${id}"[^>]*>`))?.[0];
  expect(control).toBeDefined();
  expect(control).not.toContain('aria-label=');
  expect(html.match(new RegExp(`for="${id}"`, "g"))).toHaveLength(1);
}
