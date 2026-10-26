import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmployeeTransferStatus } from "./EmployeeTransferStatus";
import { EmployeeEmploymentActions } from "./EmployeeEmploymentActions";
import type { EmployeeTransfer, EmploymentEmployee } from "./lib/employment";
const mocks = vi.hoisted(() => ({ transfer: null as EmployeeTransfer | null | undefined, retry: vi.fn(), cancel: vi.fn(), canManageTarget: true, query: vi.fn(), buttons: {} as Record<string, () => void>, confirm: undefined as (() => Promise<unknown>) | undefined }));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).endsWith(":retryTransfer") ? mocks.retry : mocks.cancel,
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref); mocks.query(name, args);
    if (name === "employeeTermination:getEmployeeTransfer") return mocks.transfer;
    if (name === "projects:listActive") return [{ _id: "project-a", name: "A" }, { _id: "project-b", name: "B" }];
    return [{ projectId: "project-a", permissions: ["employees.manage"] }, { projectId: "project-b", permissions: mocks.canManageTarget ? ["employees.manage"] : [] }];
  },
}));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (action: () => Promise<unknown>) => ({ pending: false, run: action }) }));
vi.mock("./EmployeeTransferDialog", () => ({ EmployeeTransferDialog: () => null }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: ({ onConfirm, effects }: { onConfirm: () => Promise<unknown>; effects: string[] }) => { mocks.confirm = onConfirm; return <p>{effects.join(" ")}</p>; } }));
vi.mock("react/jsx-dev-runtime", async original => {
  const actual = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...actual, jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
    const props = args[1];
    if (props && typeof props === "object" && "onClick" in props && typeof props.onClick === "function" && "children" in props && typeof props.children === "string") mocks.buttons[props.children] = props.onClick as () => void;
    return actual.jsxDEV(...args);
  } };
});
const employee: EmploymentEmployee = { _id: "employee-a" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "test@test.test", cardNumber: "123", projectId: "project-a" as Id<"projects">, isActive: true };
const source: EmploymentEmployee = { ...employee, terminationType: "transfer", employmentEndDate: "2026-10-26", isActive: false };
function status(person = source) { return renderToStaticMarkup(<EmployeeTransferStatus employee={person} />); }
function actions(person = employee) { return renderToStaticMarkup(<EmployeeEmploymentActions employee={person} />); }
beforeEach(() => {
  vi.clearAllMocks(); mocks.canManageTarget = true; mocks.buttons = {};
  mocks.transfer = { transferId: "transfer" as Id<"accessTransfers">, status: "revoking", counterpartProjectName: "Yeni proje", counterpartEmployeeId: "employee-b" as Id<"employees">, requestedAt: Date.parse("2026-10-26T21:30:00Z"), deadlineAt: Date.parse("2026-10-27T21:30:00Z"), completedAt: null, stuckReason: null, lastError: null, canCancel: true, canRetry: false,
    targets: [
      { deviceId: "device-1" as Id<"devices">, deviceName: "Kapı 1", brand: "hikvision", state: "confirmed", lastSeen: Date.parse("2026-10-26T09:20:00Z"), lastError: null, confirmedAt: 1 },
      { deviceId: "device-2" as Id<"devices">, deviceName: "Kapı 2", brand: "ide_smart", state: "pending", lastSeen: null, lastError: null, confirmedAt: null },
    ] };
});
it("revoking iki cihazı, bir silme onayını ve UTC+3 saatlerini gösterir; canlı sorgular", () => {
  const html = status();
  for (const text of ["Başka projeye taşınıyor", "Yeni proje", "1 / 2 cihazda silme tamamlandı", "Kapı 1", "Kapı 2", "Silindi", "Bekliyor", "27.10.2026 00:30", "26.10.2026 12:20", "Bilinmiyor"]) expect(html).toContain(text);
  expect(mocks.query).toHaveBeenCalledWith("employeeTermination:getEmployeeTransfer", { employeeId: "employee-a" });
});
it("B tarafında kartın silme onayından sonra verileceğini ve bitişi açıklar", () => {
  expect(status(employee)).toContain("projesinden taşınıyor — kart eski cihazlardan silinince verilecek");
  if (!mocks.transfer) throw new Error("fixture");
  mocks.transfer = { ...mocks.transfer, status: "done", completedAt: Date.parse("2026-10-27T01:00:00Z"), canCancel: false };
  expect(status(employee)).toContain("Yeni proje projesinden taşındı");
  const html = status(); expect(html).toContain("Başka projeye taşındı"); expect(html).toContain("27.10.2026 04:00"); expect(html).not.toContain("Yeniden dene");
});
it("stuck nedenini, cihaz hatasını ve yetkili retry/cancel eylemlerini sunar", async () => {
  if (!mocks.transfer) throw new Error("fixture");
  mocks.transfer = { ...mocks.transfer, status: "stuck", canRetry: true, stuckReason: "24 saat içinde onay alınamadı", targets: mocks.transfer.targets.map(target => target.state === "pending" ? { ...target, state: "failed", lastError: "Cihaz yanıt vermedi" } : target) };
  const html = status();
  for (const text of ["Taşıma takıldı", "24 saat içinde onay alınamadı", "Cihaz yanıt vermedi", "Başarısız", "Yeniden dene", "Taşımayı iptal et", "Kişi eski projede yeniden aktif olur; yeni projedeki kartsız kayıt silinir."]) expect(html).toContain(text);
  mocks.buttons["Yeniden dene"](); expect(mocks.retry).toHaveBeenCalledWith({ transferId: "transfer" });
  await mocks.confirm?.(); expect(mocks.cancel).toHaveBeenCalledWith({ transferId: "transfer" });
});
it("superseded kartı açıklayıp yeniden denemeyi gizler, kaldırılmış cihaz rozetini korur", () => {
  if (!mocks.transfer) throw new Error("fixture");
  mocks.transfer = { ...mocks.transfer, status: "stuck", canRetry: true, targets: mocks.transfer.targets.map((target, index) => ({ ...target, state: index ? "superseded" : "deviceRemoved" })) };
  const html = status();
  expect(html).toContain("Bu kart eski projede başka aktif kayıtta; o kaydı düzeltin ya da taşımayı iptal edin");
  expect(html).toContain("Korundu"); expect(html).toContain("Cihaz kaldırıldı"); expect(html).not.toContain(">Yeniden dene<");
});
it("yetki yokken retry/cancel göstermez ve taşıma yokken boş döner", () => {
  if (!mocks.transfer) throw new Error("fixture");
  mocks.transfer = { ...mocks.transfer, status: "stuck", canRetry: false, canCancel: false };
  expect(status()).not.toContain(">Yeniden dene<"); expect(status()).not.toContain(">Taşımayı iptal et<");
  mocks.transfer = null; expect(status()).toBe("");
});
it("A tarafında Geri al göstermez; aktif B kaydında ikinci taşıma/işten çıkarma açmaz", () => {
  expect(actions(source)).not.toContain("Geri al");
  expect(actions()).not.toContain("Başka projeye taşı"); expect(actions()).not.toContain("İşten çıkar");
  if (!mocks.transfer) throw new Error("fixture");
  mocks.transfer = { ...mocks.transfer, status: "done" };
  expect(actions(source)).not.toContain("Geri al");
});
it("yalnız aktif, ziyaretçi olmayan, yetkili ve devri olmayan kişiye giriş sunar", () => {
  mocks.transfer = null; expect(actions()).toContain("Başka projeye taşı");
  expect(actions({ ...employee, isVisitor: true })).not.toContain("Başka projeye taşı");
  expect(actions({ ...employee, isActive: false })).not.toContain("Başka projeye taşı");
  mocks.canManageTarget = false; expect(actions()).not.toContain("Başka projeye taşı");
  mocks.transfer = undefined; expect(actions()).not.toContain("Başka projeye taşı");
});
