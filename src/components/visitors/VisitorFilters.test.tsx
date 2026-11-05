import { expectLabel } from "@/test-utils/filterLabel";
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
  expect(html).toMatch(/<label[^>]*>Erişim durumu<\/label>/);
  expectLabel(html, "Erişim durumu");
  expect(html).toContain("Tüm durumlar");
  expect(html).toContain("Filtreleri temizle");
  expect(html).not.toContain("w-48");
});
