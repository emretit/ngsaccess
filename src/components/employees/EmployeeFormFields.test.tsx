import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import EmployeeFormFields from "./EmployeeFormFields";
import type { EmployeeFormData } from "./hooks/useEmployeeFormData";
const formData: EmployeeFormData = { firstName: "", lastName: "", email: "", tcNo: "", cardNumber: "", payrollCode: "", companyId: null, departmentId: null, positionId: null, accessRuleId: null, shift: null, shiftId: null, photoUrl: null, notes: "", isActive: true, hourlyRate: null, monthlySalary: null };
function render(autoFocusFirstName: boolean) { return renderToStaticMarkup(<EmployeeFormFields formData={formData} setFormData={() => {}} companies={[]} departments={[]} accessRules={[]} positions={[]} autoFocusFirstName={autoFocusFirstName} />); }
it("02-O8: gives access its own fieldset and unambiguous empty option", () => {
  const html = render(false);
  expect(html).toMatch(/<legend[^>]*>Erişim<\/legend><div><label[^>]*>Erişim kuralı ekle/);
  expect(html).toContain("Kural eklenmesin");
  expect(html).not.toContain("Yeni kural ekleme");
});
it("02-D7: focuses first name only for a new employee", () => {
  expect(render(true)).toMatch(/id="employee-firstName"[^>]*autofocus=""/);
  expect(render(false)).not.toContain('autofocus=""');
});
