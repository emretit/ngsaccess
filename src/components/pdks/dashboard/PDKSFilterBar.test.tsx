import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PDKSFilterBar, clearPdksFilters, type FilterValues } from "./PDKSFilterBar";
vi.mock("@/hooks/usePdksFilterOptions", () => ({ usePdksFilterOptions: () => ({ departments: [], companies: [], positions: [], shifts: [{ _id: "shift", name: "Gündüz" }] }) }));
vi.mock("@/components/ui/sheet", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Sheet: Box, SheetContent: Box, SheetHeader: Box, SheetTitle: Box, SheetDescription: Box };
});
const values: FilterValues = { dateRange: { from: undefined, to: undefined }, reportType: "daily", person: "", statusFilter: "all", shiftId: "shift" as Id<"shifts"> };
it("has no shift selector or shift filter counter", () => {
  const html = renderToStaticMarkup(<PDKSFilterBar values={values} onChange={vi.fn()} />);
  expect(html).not.toContain("Vardiya");
  expect(html).not.toContain("Gündüz");
  expect(html).not.toContain("Diğer filtreler (1)");
  expect(html).toMatch(/disabled=""[^>]*>Filtreleri temizle/);
});
it("clear preserves the shift selection and period", () => {
  expect(clearPdksFilters({ ...values, person: "Ayşe", statusFilter: "late" })).toMatchObject({ shiftId: values.shiftId, reportType: "daily", person: "", statusFilter: "all" });
});

vi.mock("@/components/ui/select", async original => ({
  ...await original<typeof import("@/components/ui/select")>(),
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div role="option">{children}</div>,
}));
it("associates each upper field label once and keeps all options and clear visible", () => {
  const html = renderToStaticMarkup(<PDKSFilterBar values={values} onChange={vi.fn()} />);
  for (const label of ["Şirket", "Departman", "Pozisyon", "Durum"]) {
    const id = html.match(new RegExp(`<label for="([^"]+)">${label}</label>`))?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).not.toContain(`aria-label="${label}"`);
  }
  for (const text of ["Tüm şirketler", "Tüm departmanlar", "Tüm pozisyonlar", "Tüm durumlar", "Filtreleri temizle"]) expect(html).toContain(text);
});
