import type { ButtonHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeForm, { deactivationEffects, sendsDeactivation } from "./EmployeeForm";
const mocks = vi.hoisted(() => ({ query: vi.fn(), current: undefined as unknown, stages: [] as string[], saved: undefined as { employeeId: Id<"employees"> } | undefined, loading: false, uploading: false, clicks: new Map<string, () => void>(), remoteChanged: false, reload: vi.fn(), confirm: undefined as (() => void) | undefined, optionsLoading: true, formData: {} as Record<string, unknown>, initialData: undefined as string | undefined }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p" }) }));
vi.mock("convex/react", () => ({ useMutation: () => async () => null, useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { const name = getFunctionName(ref); mocks.query(name, args); return name === "employees:getById" ? mocks.current : name === "fingerprintEnrollment:listForEmployee" ? undefined : []; } }));
vi.mock("./hooks/useEmployeeFormData", () => ({ useEmployeeFormData: () => ({ formData: mocks.formData, initialData: mocks.remoteChanged ? '{"firstName":"old"}' : mocks.initialData, remoteChanged: mocks.remoteChanged, reloadLatest: mocks.reload, departments: [], companies: [], accessRules: [], positions: [], optionsLoading: mocks.optionsLoading }) }));
vi.mock("./hooks/useEmployeeFormSubmit", () => ({ useEmployeeFormSubmit: () => ({ stages: mocks.stages, isLoading: mocks.loading, savedResult: mocks.saved }) }));
vi.mock("./hooks/usePhotoUpload", () => ({ usePhotoUpload: () => ({ isLoading: mocks.uploading }) }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: (dirty: boolean) => ({ dialog: null, requestClose: (action: () => void) => { if (dirty) mocks.confirm = action; else action(); } }) }));
vi.mock("./PhotoUpload", () => ({ default: () => null }));
vi.mock("./EmployeeFormFields", () => ({ default: () => null }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => {
  if (typeof children === "string" && onClick) mocks.clicks.set(children, () => onClick({} as React.MouseEvent<HTMLButtonElement>));
  return <button {...props}>{children}</button>;
} }));
const employee: Employee = { _id: "e" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", isActive: true };
beforeEach(() => { vi.clearAllMocks(); mocks.current = undefined; mocks.stages = []; mocks.saved = undefined; mocks.loading = false; mocks.uploading = false; mocks.clicks.clear(); mocks.remoteChanged = false; mocks.confirm = undefined; mocks.optionsLoading = true; mocks.formData = {}; mocks.initialData = undefined; });
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

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "hr", loading: false }) }));

it("pasifleştirme onayı parmak izi sayısını bildirir; sayı bilinmiyorsa genel uyarı, sıfırsa onay yok", () => {
  expect(deactivationEffects(0)).toBeUndefined();
  expect(deactivationEffects(2)?.[0]).toBe("2 parmak izi sistemden ve tüm cihazlardan kalıcı silinir.");
  expect(deactivationEffects(undefined)?.[0]).toContain("varsa");
  expect(deactivationEffects(1)?.[1]).toContain("geri getirmez");
});

it("düzenlemede kaydet çubuğu temiz formda da görünür ve pasiftir (eklemeyle aynı)", () => {
  mocks.optionsLoading = false;
  mocks.formData = { ...employee };
  mocks.initialData = JSON.stringify(mocks.formData);
  const html = renderToStaticMarkup(<EmployeeForm embedded employee={employee} onClose={() => {}} onSave={() => {}} />);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Değişiklikleri geri al<\/button>/);
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  mocks.formData = { ...employee, firstName: "Ayşe" };
  const dirty = renderToStaticMarkup(<EmployeeForm embedded employee={employee} onClose={() => {}} onSave={() => {}} />);
  expect(dirty).not.toMatch(/<button[^>]*disabled=""[^>]*>Değişiklikleri geri al<\/button>/);
  expect(dirty).not.toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  expect(renderToStaticMarkup(<EmployeeForm onClose={() => {}} onSave={() => {}} />)).toContain("Vazgeç");
});

it("pasifleştirme onayı yalnız kayıt isActive=false gönderecekse açılır", () => {
  expect(sendsDeactivation(true, JSON.stringify({ isActive: true }))).toBe(false);
  expect(sendsDeactivation(false, JSON.stringify({ isActive: true }))).toBe(true);
  // Taslak açılırken de pasifti (başkası arada aktifleştirdi): onlyChangedFields isActive'i göndermez.
  expect(sendsDeactivation(false, JSON.stringify({ isActive: false }))).toBe(false);
  expect(sendsDeactivation(false, undefined)).toBe(true);
});
