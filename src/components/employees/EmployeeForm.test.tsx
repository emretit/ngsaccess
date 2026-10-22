import type { ButtonHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeForm from "./EmployeeForm";
const mocks = vi.hoisted(() => ({ query: vi.fn(), current: undefined as unknown, stages: [] as string[], saved: undefined as { employeeId: Id<"employees"> } | undefined, loading: false, uploading: false, clicks: new Map<string, () => void>(), remoteChanged: false, reload: vi.fn(), confirm: undefined as (() => void) | undefined }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p" }) }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { const name = getFunctionName(ref); mocks.query(name, args); return name === "employees:getById" ? mocks.current : []; } }));
vi.mock("./hooks/useEmployeeFormData", () => ({ useEmployeeFormData: () => ({ formData: {}, initialData: mocks.remoteChanged ? "old" : undefined, remoteChanged: mocks.remoteChanged, reloadLatest: mocks.reload, departments: [], companies: [], accessRules: [], positions: [], optionsLoading: true }) }));
vi.mock("./hooks/useEmployeeFormSubmit", () => ({ useEmployeeFormSubmit: () => ({ stages: mocks.stages, isLoading: mocks.loading, savedResult: mocks.saved }) }));
vi.mock("./hooks/usePhotoUpload", () => ({ usePhotoUpload: () => ({ isLoading: mocks.uploading }) }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: (dirty: boolean) => ({ dialog: null, requestClose: (action: () => void) => { if (dirty) mocks.confirm = action; else action(); } }) }));
vi.mock("./PhotoUpload", () => ({ default: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => {
  if (typeof children === "string" && onClick) mocks.clicks.set(children, () => onClick({} as React.MouseEvent<HTMLButtonElement>));
  return <button {...props}>{children}</button>;
} }));
const employee: Employee = { _id: "e" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", isActive: true };
beforeEach(() => { vi.clearAllMocks(); mocks.current = undefined; mocks.stages = []; mocks.saved = undefined; mocks.loading = false; mocks.uploading = false; mocks.clicks.clear(); mocks.remoteChanged = false; mocks.confirm = undefined; });
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

it("yeni kayıt başarısında ayrıntılara devam id'yi üst akışa taşır; düzenlemede gösterilmez", () => {
  mocks.stages = ["Personel kaydedildi."];
  mocks.saved = { employeeId: employee._id };
  const onContinue = vi.fn(); const onSave = vi.fn();
  const fresh = renderToStaticMarkup(<EmployeeForm onClose={() => {}} onSave={onSave} onContinue={onContinue} />);
  expect(fresh).toContain("Ayrıntılara devam et");
  expect(fresh).toContain("Rıza ve parmak izi işlemleri kişinin ayrıntılarında.");
  mocks.clicks.get("Ayrıntılara devam et")?.();
  expect(onContinue).toHaveBeenCalledWith({ employeeId: employee._id });
  mocks.clicks.get("Tamam")?.(); expect(onSave).toHaveBeenCalledWith({ employeeId: employee._id });
  const edit = renderToStaticMarkup(<EmployeeForm employee={employee} onClose={() => {}} onSave={onSave} onContinue={onContinue} />);
  expect(edit).not.toContain("Ayrıntılara devam et");
  expect(edit).toContain("Tamam");
});
it("seçenek, fotoğraf ve kayıt bekleme metinleri ayrıdır; kayıt aria-busy ile duyurulur", () => {
  const render = () => renderToStaticMarkup(<EmployeeForm onClose={() => {}} onSave={() => {}} />);
  expect(render()).toContain("Yükleniyor");
  expect(render()).not.toContain("Kaydediliyor");
  mocks.uploading = true;
  expect(render()).toContain("Fotoğraf yükleniyor");
  mocks.uploading = false; mocks.loading = true;
  const html = render(); expect(html).toContain("Kaydediliyor"); expect(html).toContain('aria-busy="true"');
});

it("kirli formda güncel hali yükleme taslağı onaydan önce atmaz", () => {
  mocks.remoteChanged = true;
  const html = renderToStaticMarkup(<EmployeeForm employee={employee} onClose={() => {}} onSave={() => {}} />);
  expect(html).toContain("Bu kayıt siz düzenlerken değişti.");
  mocks.clicks.get("Güncel hali yükle")?.();
  expect(mocks.reload).not.toHaveBeenCalled();
  expect(mocks.confirm).toBeDefined();
  mocks.confirm?.();
  expect(mocks.reload).toHaveBeenCalledOnce();
});
