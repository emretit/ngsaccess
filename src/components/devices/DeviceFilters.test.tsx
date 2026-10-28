import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DeviceFilters } from "./DeviceFilters";

vi.mock("@/components/ui/select", async original => ({
  ...await original<typeof import("@/components/ui/select")>(),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}));

it.each([0, 2])("keeps FIELD labels and clear visible for %s results", deviceCount => {
  const html = renderToStaticMarkup(<DeviceFilters search="eşleşmeyen" onSearchChange={() => {}} statusCounts={{ all: 2, online: 1, offline: 1, never: 0 }} typeCounts={{ Turnike: 2 }} statusFilter="all" onStatusFilterChange={() => {}} typeFilter="all" onTypeFilterChange={() => {}} deviceTypes={["Turnike"]} onAddNew={() => {}} onAddFromCloud={() => {}} onClearFilters={() => {}} deviceCount={deviceCount} />);
  expect(html.match(/grid w-full min-w-0 gap-1 text-xs min-\[761px\]:w-40/g)).toHaveLength(2);
  for (const label of ["Bağlantı", "Tip"]) {
    expect(html).toContain(`>${label}</label>`);
    expectLabel(html, label);
  }
  expect(html).toContain("Tüm bağlantılar (2)");
  expect(html).toContain("Tüm tipler (2)");
  expect(html).toContain("Turnike (2)");
  expect(html).toContain("Filtreleri temizle");
  expect(html).not.toContain("]:hidden");
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
