import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { EmployeeBulkActions } from "./EmployeeBulkActions";
it("02-O6: separates delete using an outline and red text", () => {
  const html = renderToStaticMarkup(<EmployeeBulkActions selectedCount={1} departments={[]} selectedDepartment="" onDepartmentChange={() => {}} onUpdateDepartment={() => {}} onDelete={() => {}} />);
  expect(html).toMatch(/<button[^>]*class="[^"]*border[^"]*ml-3 border-destructive\/40 text-destructive[^>]*>Seçilenleri sil<\/button>/);
});
