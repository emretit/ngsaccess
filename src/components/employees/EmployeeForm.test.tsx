import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeForm from "./EmployeeForm";
const mocks = vi.hoisted(() => ({ query: vi.fn(), current: undefined as unknown }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p" }) }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { const name = getFunctionName(ref); mocks.query(name, args); return name === "employees:getById" ? mocks.current : []; } }));
vi.mock("./hooks/useEmployeeFormData", () => ({ useEmployeeFormData: () => ({ formData: {}, departments: [], companies: [], accessRules: [], positions: [], optionsLoading: true }) }));
vi.mock("./hooks/useEmployeeFormSubmit", () => ({ useEmployeeFormSubmit: () => ({ stages: [], isLoading: false }) }));
vi.mock("./hooks/usePhotoUpload", () => ({ usePhotoUpload: () => ({ isLoading: false }) }));
vi.mock("./PhotoUpload", () => ({ default: () => null }));
vi.mock("./FormActions", () => ({ default: () => null }));
const employee: Employee = { _id: "e" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", isActive: true };
beforeEach(() => { vi.clearAllMocks(); mocks.current = undefined; });
it("02-D9: edit subscribes to a single employee and handles deletion", () => {
  renderToStaticMarkup(<EmployeeForm employee={employee} onClose={() => {}} onSave={() => {}} />);
  expect(mocks.query).toHaveBeenCalledWith("employees:getById", { employeeId: "e" });
  expect(mocks.query.mock.calls.some(([name]) => name === "employees:list")).toBe(false);
  mocks.current = null;
  const html = renderToStaticMarkup(<EmployeeForm employee={employee} onClose={() => {}} onSave={() => {}} />);
  expect(html).toContain("Personel kaydı artık bulunamıyor.");
});
it("02-D9: new form skips the employee lookup", () => {
  renderToStaticMarkup(<EmployeeForm onClose={() => {}} onSave={() => {}} />);
  expect(mocks.query).toHaveBeenCalledWith("employees:getById", "skip");
});
