vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => mocks.permissions === null || mocks.permissions.includes(permission), loading: false }) }));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeTable from "./EmployeeTable";
const mocks = vi.hoisted(() => ({ permissions: null as string[] | null, states: [] as unknown[], cursor: 0, selected: [] as string[], items: [] as { children?: ReactNode; onSelect?: () => void; disabled?: boolean }[], sync: vi.fn(), confirm: undefined as (() => void) | undefined, bulkSend: undefined as (() => void) | undefined }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => { const i = mocks.cursor++; if (!(i in mocks.states)) mocks.states[i] = typeof initial === "function" ? initial() : initial; return [mocks.states[i], (next: unknown) => { mocks.states[i] = next; }]; } }));
vi.mock("convex/react", () => ({ useQuery: () => [], useAction: () => mocks.sync, useMutation: () => vi.fn() }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p", isAdmin: true }) }));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (run: unknown) => ({ run, pending: false }) }));
vi.mock("@/hooks/useEmployeeTable", () => ({ useEmployeeTable: (employees: Employee[]) => ({ sortedEmployees: employees, selectedEmployees: mocks.selected, selectedDepartment: "", handleSelectAll: vi.fn(), handleSelectEmployee: vi.fn(), clearSelection: vi.fn() }) }));
vi.mock("@/components/shared/RowActions", () => ({ RowActions: ({ children }: { children?: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/dropdown-menu", () => ({ DropdownMenuItem: (props: { children?: ReactNode; onSelect?: () => void; disabled?: boolean }) => { mocks.items.push(props); return <div>{props.children}</div>; } }));
vi.mock("./EmployeeDeleteDialog", () => ({ EmployeeDeleteDialog: () => null }));
vi.mock("./EmployeePasswordResetDialog", () => ({ EmployeePasswordResetDialog: () => null }));
vi.mock("./EmployeeBulkActions", () => ({ EmployeeBulkActions: ({ onSyncToDevices }: { onSyncToDevices: () => void }) => { mocks.bulkSend = onSyncToDevices; return <div>Toplu işlemler</div>; } }));
vi.mock("./EmployeeSyncConfirmDialog", () => ({ EmployeeSyncConfirmDialog: ({ onConfirm }: { onConfirm: () => void }) => { mocks.confirm = onConfirm; return <div>Gönderim onayı</div>; } }));
const employee: Employee = { _id: "e" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", isActive: true };
function render(employees = [employee]) { mocks.cursor = 0; mocks.items = []; return renderToStaticMarkup(<EmployeeTable employees={employees} onViewDetails={() => {}} />); }
beforeEach(() => { mocks.permissions = null; vi.clearAllMocks(); mocks.states = []; mocks.selected = []; mocks.confirm = undefined; mocks.sync.mockResolvedValue({ synced: 1, failed: 0, errors: [] }); });
it("02-O2: row send opens confirmation and calls device action only after confirmation", () => {
  render();
  mocks.items.find(item => item.children === "Cihazlara gönder")?.onSelect?.();
  expect(mocks.sync).not.toHaveBeenCalled();
  expect(render()).toContain("Gönderim onayı");
  mocks.confirm?.();
  expect(mocks.sync).toHaveBeenCalledWith({ employeeId: "e" });
});

it("02-O2: bulk send also waits for confirmation", async () => {
  const employees = [employee, { ...employee, _id: "e2" as Id<"employees"> }];
  mocks.selected = ["e", "e2"];
  expect(render(employees)).toContain("Toplu işlemler");
  mocks.bulkSend?.();
  expect(mocks.sync).not.toHaveBeenCalled();
  render(employees);
  mocks.confirm?.();
  await vi.waitFor(() => expect(mocks.sync).toHaveBeenCalledTimes(2));
});
it("02-O3: result report keeps raw SDK errors in closed technical details", () => {
  mocks.states = [null, [], ["Cihaza gönderilemedi", "NET_DVR_SendRemoteConfig failed: 17"]];
  const html = render();
  expect(html).toMatch(/<details><summary[^>]*>Teknik ayrıntı<\/summary><p>NET_DVR_SendRemoteConfig failed: 17<\/p><\/details>/);
});
it("biyometrik kolonu yöneticiye yüz ve parmak izi durumunu gösterir", () => {
  const html = render();
  expect(html).toContain("Biyometrik");
  expect(html).toContain("Yüz kaydı yok");
  expect(html).toContain("Parmak izi kaydı yok");
});

it.each([
  [["employees.manage"], true, false, false],
  [["accessRules.manage"], false, true, false],
  [["biometrics.manage"], false, false, true],
  [[], false, false, false],
] as const)("personel işlemleri ayrı yetkilerle görünür: %j", (permissions, manage, sync, biometric) => {
  mocks.permissions = [...permissions];
  const html = render();
  expect(mocks.items.some(item => item.children === "Sil")).toBe(manage);
  expect(mocks.items.some(item => item.children === "Cihazlara gönder")).toBe(sync);
  expect(html.includes("Biyometrik")).toBe(biometric);
});

it.each([false, true])("keeps employee headers and dynamic colspan while empty (biometrics=%s)", biometrics => {
  mocks.permissions = biometrics ? ["biometrics.manage"] : [];
  mocks.cursor = 0;
  const html = renderToStaticMarkup(<EmployeeTable employees={[]} showDepartment showCompany onViewDetails={() => {}} />);
  for (const label of ["Ad soyad", "E-posta", "Şirket", "Departman", "Pozisyon", "Kart no", "Durum", "İşlemler"]) expect(html).toContain(label);
  expect(html).toMatch(new RegExp(`<tbody[^>]*><tr[^>]*><td[^>]*colSpan="${biometrics ? 10 : 9}"`));
  expect(html).toContain("Henüz personel eklenmedi");
});

it("keeps employee headers while loading", () => {
  const html = renderToStaticMarkup(<EmployeeTable employees={[]} loading onViewDetails={() => {}} />);
  expect(html).toContain("Ad soyad");
  expect(html).toContain("<tbody");
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("Personel bilgileri yükleniyor…");
});

it("P01: e-postasız kişide mobil giriş bağlantısı pasif", () => {
  const invite = () => mocks.items.find(item => item.children === "Mobil giriş bağlantısı gönder");
  render();
  expect(invite()?.disabled).toBe(false);
  render([{ ...employee, email: "" }]);
  expect(invite()?.disabled).toBe(true);
});
