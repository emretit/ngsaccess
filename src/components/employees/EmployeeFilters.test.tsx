import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmployeeFilters } from "./EmployeeFilters";
it("02-D2/D3: uses shared comboboxes and restricts sorting dropdown to mobile", () => {
  const html = renderToStaticMarkup(<EmployeeFilters searchQuery="" onSearchChange={() => {}} status="all" statusCounts={{ all: 7, active: 5, inactive: 2 }} onStatusChange={() => {}} sort="name:asc" onSortChange={() => {}} onClear={() => {}} hasFilters={false} />);
  expect(html.match(/role="combobox"/g)).toHaveLength(2);
  expect(html).toContain('class="min-[760px]:hidden"');
  expect(html).toContain('aria-label="Personel sıralaması"');
  expect(html).toContain('aria-label="Personel durumu"');
});
