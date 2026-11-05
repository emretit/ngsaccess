import { expectLabel } from "@/test-utils/filterLabel";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { EmployeeFilters } from "./EmployeeFilters";
it("02-D2/D3: uses shared comboboxes and restricts sorting dropdown to mobile", () => {
  const html = renderToStaticMarkup(<EmployeeFilters searchQuery="" onSearchChange={() => {}} status="all" statusCounts={{ all: 7, active: 5, inactive: 2 }} onStatusChange={() => {}} sort="name:asc" onSortChange={() => {}} onClear={() => {}} hasFilters={false} />);
  expect(html.match(/role="combobox"/g)).toHaveLength(2);
  expect(html).toContain('class="min-[760px]:hidden w-full min-w-0"');
  expectLabel(html, "Personel sıralaması");
  expectLabel(html, "Personel durumu");
});

vi.mock("@/components/ui/select", async original => ({
  ...await original<typeof import("@/components/ui/select")>(),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}));
it("shows FIELD labels, all statuses and a visible clear action even with zero counts", () => {
  const html = renderToStaticMarkup(<EmployeeFilters searchQuery="eşleşmeyen" onSearchChange={() => {}} status="all" statusCounts={{ all: 0, active: 0, inactive: 0 }} onStatusChange={() => {}} sort="name:asc" onSortChange={() => {}} onClear={() => {}} hasFilters={false} />);
  expectLabel(html, "Personel durumu");
  expectLabel(html, "Personel sıralaması");
  expect(html).toContain("Tüm durumlar (0)");
  expect(html).toContain("Filtreleri temizle");
  expect(html).not.toContain("button:last-of-type");
});
