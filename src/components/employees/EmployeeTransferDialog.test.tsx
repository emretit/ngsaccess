import type { FormEvent, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmployeeTransferDialog } from "./EmployeeTransferDialog";
import type { EmploymentEmployee } from "./lib/employment";
import { createAsyncGuard } from "@/lib/asyncGuard";

type Preflight = FunctionReturnType<typeof api.employeeTermination.transferPreflight>;
const mocks = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, pending: false, start: vi.fn(), navigate: vi.fn(), project: vi.fn(),
  query: vi.fn(), preflight: undefined as Preflight | undefined,
  close: undefined as ((open: boolean) => void) | undefined,
  escape: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
  outside: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
  submit: undefined as ((event: FormEvent) => Promise<void>) | undefined,
  buttons: {} as Record<string, () => void>, selects: {} as Record<string, (value: string) => void>,
  check: undefined as ((checked: boolean) => void) | undefined,
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => {
  const index = mocks.cursor++;
  if (!(index in mocks.states)) mocks.states[index] = typeof initial === "function" ? initial() : initial;
  return [mocks.states[index], (next: unknown) => { mocks.states[index] = typeof next === "function" ? next(mocks.states[index]) : next; }];
} }));
vi.mock("react-router-dom", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ setActiveProjectId: mocks.project }), useProjectChangeGuard: () => {} }));
vi.mock("convex/react", () => ({
  useMutation: () => mocks.start,
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref); mocks.query(name, args);
    if (args === "skip") return undefined;
    if (name === "employeeTermination:transferPreflight") return mocks.preflight;
    if (name === "departments:list") return [{ _id: "dept-b", name: "Üretim B" }];
    return [{ _id: "rule-b", name: "B kapıları", isActive: true }];
  },
}));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (action: () => Promise<unknown>) => {
  const guard = createAsyncGuard(); return { pending: mocks.pending, run: async () => (await guard.run(action)).status === "success" };
} }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: typeof mocks.close }) => { mocks.close = onOpenChange; return <div>{children}</div>; }, DialogContent: ({ children, onEscapeKeyDown, onInteractOutside }: { children: ReactNode; onEscapeKeyDown: typeof mocks.escape; onInteractOutside: typeof mocks.outside }) => { mocks.escape = onEscapeKeyDown; mocks.outside = onInteractOutside; return <div>{children}</div>; }, DialogHeader: Part, DialogTitle: Part, DialogDescription: Part, DialogFooter: Part };
});
vi.mock("@/components/ui/select", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Select: ({ children, onValueChange }: { children: ReactNode; onValueChange: (value: string) => void }) => { mocks.selects[Object.keys(mocks.selects).length === 0 ? "first" : "second"] = onValueChange; return <div>{children}</div>; }, SelectContent: Part, SelectItem: Part, SelectTrigger: Part, SelectValue: () => null };
});
vi.mock("@/components/ui/checkbox", () => ({ Checkbox: ({ onCheckedChange }: { onCheckedChange: typeof mocks.check }) => { mocks.check = onCheckedChange; return <input type="checkbox" />; } }));
vi.mock("react/jsx-dev-runtime", async original => {
  const actual = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...actual, jsxDEV: (...args: Parameters<typeof actual.jsxDEV>) => {
    const [type, props] = args;
    if (props && typeof props === "object") {
      if (type === "form" && "onSubmit" in props) mocks.submit = props.onSubmit as typeof mocks.submit;
      if ("onClick" in props && typeof props.onClick === "function" && "children" in props && typeof props.children === "string") mocks.buttons[props.children] = props.onClick as () => void;
    }
    return actual.jsxDEV(...args);
  } };
});
const employee: EmploymentEmployee = { _id: "employee-a" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "123", projectId: "project-a" as Id<"projects">, isActive: true };
const projects = ["a", "b", "c"].map(key => ({ _id: `project-${key}` as Id<"projects">, name: `Proje ${key.toUpperCase()}`, _creationTime: 1, isActive: true }));
const permissions: FunctionReturnType<typeof api.roles.myPermissionsByProject> = [
  { projectId: projects[0]._id, role: "admin", permissions: ["employees.manage"] },
  { projectId: projects[1]._id, role: "admin", permissions: ["employees.manage", "accessRules.manage"] },
  { projectId: projects[2]._id, role: "viewer", permissions: ["employees.view"] },
];
const close = vi.fn();
function render(perms = permissions) {
  mocks.cursor = 0; mocks.buttons = {}; mocks.selects = {};
  return renderToStaticMarkup(<EmployeeTransferDialog employee={employee} projects={projects} permissions={perms} open onOpenChange={close} />);
}
function confirmation() {
  render(); mocks.selects.first("project-b"); render(); mocks.buttons.Devam(); render(); mocks.buttons.Devam(); return render();
}
const event = () => ({ preventDefault: vi.fn() } as unknown as FormEvent);
beforeEach(() => {
  vi.clearAllMocks(); mocks.states = []; mocks.pending = false;
  mocks.preflight = { reasons: [], offlineDevices: [], activeVisitorCount: 0, targetDeviceCount: 2 };
  mocks.start.mockResolvedValue({ transferId: "transfer", targetEmployeeId: "employee-b" });
});
it("yalnız başka ve yönetilebilen projeleri seçtirir; hedef değişince opsiyonları temizler", () => {
  const html = render();
  expect(html).toContain("Proje B"); expect(html).not.toContain("Proje A"); expect(html).not.toContain("Proje C");
  mocks.selects.first("project-b"); render(); mocks.buttons.Devam(); render();
  mocks.selects.first("dept-b"); mocks.check?.(true); render(); mocks.buttons.Geri(); render();
  mocks.selects.first("project-b");
  expect(mocks.states[1]).toBeUndefined(); expect(mocks.states[2]).toEqual([]);
});
it.each([
  { code: "TRANSFER_DEVICE_OFFLINE", message: "Cihazı açın", offline: true, expected: "Kapı Paneli 2 çevrimdışı" },
  { code: "TRANSFER_ACTIVE_VISITORS", message: "Önce ziyaretleri kapatın veya ev sahibini değiştirin.", offline: false, expected: "Önce ziyaretleri kapatın" },
  { code: "TRANSFER_PERMISSION_DENIED", message: "Hedef projede kişi yönetme yetkiniz yok.", offline: false, expected: "Proje yöneticinizden gerekli yetkiyi isteyin" },
])("ön kontrol engelini ve çözümünü gösterir, başlatmaz: $code", async ({ code, message, offline, expected }) => {
  mocks.preflight = { reasons: [{ code, message }], offlineDevices: offline ? [{ deviceId: "device" as Id<"devices">, name: "Kapı Paneli 2" }] : [], targetDeviceCount: 2, activeVisitorCount: offline ? 0 : 1 };
  const html = confirmation();
  expect(html).toContain(expected); expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/);
  await mocks.submit?.(event()); expect(mocks.start).not.toHaveBeenCalled();
});
it("kontrol yüklenirken taşı pasiftir", async () => {
  mocks.preflight = undefined;
  expect(confirmation()).toContain("Taşıma engelleri kontrol ediliyor");
  await mocks.submit?.(event()); expect(mocks.start).not.toHaveBeenCalled();
});
it("hedef departman ve çoklu kural planıyla başlatır ve yeni kayda geçer", async () => {
  render(); mocks.selects.first("project-b"); render(); mocks.buttons.Devam(); render();
  mocks.selects.first("dept-b"); mocks.check?.(true); render(); mocks.buttons.Devam();
  const html = render();
  for (const text of ["geçmişi orada kalır", "Mobil hesap", "Parmak izi", "Vardiya ataması", "PDKS oluşmaz"]) expect(html).toContain(text);
  await mocks.submit?.(event());
  expect(mocks.start).toHaveBeenCalledExactlyOnceWith({ employeeId: "employee-a", targetProjectId: "project-b", departmentId: "dept-b", accessRuleIds: ["rule-b"] });
  expect(mocks.query).toHaveBeenCalledWith("accessRules:listMemberships", { projectId: "project-b" });
  expect(mocks.query).toHaveBeenCalledWith("departments:list", { projectId: "project-b" });
  expect(close).not.toHaveBeenCalled();
  expect(render()).toContain("Yeni projedeki kayda git"); mocks.buttons["Yeni projedeki kayda git"]();
  expect(mocks.navigate).toHaveBeenCalledWith("/employees", { state: { transferEmployeeId: "employee-b", transferProjectId: "project-b" } });
  expect(mocks.project).toHaveBeenCalledWith("project-b");
});
it("kural yönetme yetkisi yoksa kural sorgulamaz ve boş plan gönderir", async () => {
  const perms = permissions.map(row => ({ ...row, permissions: row.permissions.filter(value => value !== "accessRules.manage") }));
  render(perms); mocks.selects.first("project-b"); render(perms); mocks.buttons.Devam();
  expect(render(perms)).toContain("erişim kuralı yönetme yetkiniz yok");
  mocks.buttons.Devam(); render(perms); await mocks.submit?.(event());
  expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ accessRuleIds: [] }));
  expect(mocks.query).not.toHaveBeenCalledWith("accessRules:listMemberships", { projectId: "project-b" });
});
it("beklerken kapanmaz, escape/dış tıklamayı engeller ve çift istek göndermez", async () => {
  confirmation(); mocks.pending = true;
  expect(render()).toContain("Taşınıyor…");
  mocks.close?.(false); const preventDefault = vi.fn(); mocks.escape?.({ preventDefault }); mocks.outside?.({ preventDefault });
  expect(close).not.toHaveBeenCalled(); expect(preventDefault).toHaveBeenCalledTimes(2);
  await mocks.submit?.(event()); expect(mocks.start).not.toHaveBeenCalled();
  mocks.pending = false; render(); let release: ((value: unknown) => void) | undefined;
  mocks.start.mockImplementation(() => new Promise(resolve => { release = resolve; }));
  const first = mocks.submit?.(event()); const second = mocks.submit?.(event());
  expect(mocks.start).toHaveBeenCalledOnce(); release?.({ transferId: "transfer", targetEmployeeId: "employee-b" }); await Promise.all([first, second]);
});
it("sunucunun ConvexError açıklamasını gösterir ve sihirbazı açık tutar", async () => {
  mocks.start.mockRejectedValue(new ConvexError({ code: "TRANSFER_IN_PROGRESS", message: "Bu kişinin proje taşıması sürüyor. Önce mevcut taşımayı iptal edin." }));
  confirmation(); await mocks.submit?.(event());
  expect(render()).toContain("Bu kişinin proje taşıması sürüyor"); expect(close).not.toHaveBeenCalled();
});
