import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EmployeeDeliveryCard } from "./EmployeeDeliveryCard";

type Data = FunctionReturnType<typeof api.employeeDelivery.getForEmployee>;
type Device = Data["devices"][number];
const mocks = vi.hoisted(() => ({ view: true, manage: true, projectId: "project" as string | undefined, data: undefined as Data | undefined, selected: null as Device | null, confirm: undefined as (() => Promise<unknown>) | undefined, query: vi.fn(), hik: vi.fn(), ide: vi.fn(), info: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [mocks.selected, (value: Device | null) => { mocks.selected = value; }] }));
vi.mock("react-router-dom", () => ({ Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a> }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: mocks.projectId }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permission === "employees.view" ? mocks.view : mocks.manage }) }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { mocks.query(getFunctionName(ref), args); return mocks.data; }, useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).startsWith("hikvisionSync:") ? mocks.hik : mocks.ide }));
vi.mock("@/lib/notify", () => ({ notify: { info: mocks.info } }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: ({ onConfirm }: { onConfirm: () => Promise<unknown> }) => { mocks.confirm = onConfirm; return null; } }));

const device = (state: Device["state"] = "missing"): Device => ({ deviceId: "device" as Id<"devices">, name: "Panel", target: true, state, lastAttemptAt: null, lastResultAt: null, retry: null });
const render = () => renderToStaticMarkup(<EmployeeDeliveryCard employeeId={"employee" as Id<"employees">} />);
beforeEach(() => { vi.clearAllMocks(); Object.assign(mocks, { view: true, manage: true, projectId: "project", data: { devices: [], incomplete: false, hasCard: true }, selected: null }); mocks.hik.mockResolvedValue({ queued: true }); mocks.ide.mockResolvedValue({ queued: true }); });

it("yükleme, hedef yok ve kartsız durumlarını gösterir", () => {
  mocks.data = undefined; expect(render()).toContain("Cihaz teslim durumu yükleniyor");
  mocks.data = { devices: [], hasCard: false, incomplete: false };
  expect(render()).toContain("kart gönderimi beklenmez"); expect(render()).toContain("gönderim kaydı bulunamadı");
});
it("tek kişi/proje sorgusu açar; yetki veya proje yoksa skip eder", () => {
  render(); expect(mocks.query).toHaveBeenCalledExactlyOnceWith("employeeDelivery:getForEmployee", { projectId: "project", employeeId: "employee" });
  mocks.view = false; expect(render()).toBe(""); expect(mocks.query).toHaveBeenLastCalledWith("employeeDelivery:getForEmployee", "skip");
  mocks.view = true; mocks.projectId = undefined; render(); expect(mocks.query).toHaveBeenLastCalledWith("employeeDelivery:getForEmployee", "skip");
});
it.each([["delivered", "Gönderildi"], ["pending", "Bekliyor"], ["failed", "Hata"], ["missing", "Gönderim doğrulanmadı"]] as const)("cihaz durumunu görünür kılar: %s", (state, label) => {
  mocks.data = { devices: [device(state)], incomplete: true, hasCard: true };
  const html = render(); expect(html).toContain(label); expect(html).toContain("listesi eksik olabilir"); expect(html).toContain("Son deneme: Kaydedilmemiş");
});
it("deneme ve durum kaydını Europe/Istanbul saatinde gösterir", () => {
  mocks.data = { devices: [{ ...device(), lastAttemptAt: Date.parse("2026-11-27T09:00:00Z"), lastResultAt: Date.parse("2026-11-27T09:01:00Z") }], incomplete: false, hasCard: true };
  const html = render(); expect(html).toContain("12:00 (TR saati)"); expect(html).toContain("12:01 (TR saati)");
});
it.each(["hikvision", "ide"] as const)("yalnız onay eyleminde mevcut retry mutation'ını çağırır: %s", async source => {
  const row: Device = { ...device("failed"), retry: source === "hikvision" ? { source, id: "hik" as Id<"hikPendingOperations"> } : { source, id: "ide" as Id<"idePendingOperations"> } };
  mocks.data = { devices: [row], incomplete: false, hasCard: true }; mocks.selected = row;
  expect(render()).toContain("Tekrar gönder"); expect(mocks.hik).not.toHaveBeenCalled(); expect(mocks.ide).not.toHaveBeenCalled();
  await mocks.confirm?.();
  expect(source === "hikvision" ? mocks.hik : mocks.ide).toHaveBeenCalledExactlyOnceWith(source === "hikvision" ? { issueId: "hik" } : { opId: "ide" });
  expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("cihaz onayı bekleniyor"));
});
it("cihaz yönetim izni kalkınca retry yapmaz ve düğmeyi gizler", async () => {
  mocks.manage = false; mocks.selected = { ...device("failed"), retry: { source: "hikvision", id: "hik" as Id<"hikPendingOperations"> } };
  mocks.data = { devices: [mocks.selected], incomplete: false, hasCard: true };
  expect(render()).not.toContain(">Tekrar gönder</button>"); await mocks.confirm?.(); expect(mocks.hik).not.toHaveBeenCalled();
});
