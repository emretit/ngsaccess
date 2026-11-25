import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import { EmployeeFaceCard } from "./EmployeeFaceCard";
import { capturedFaceBytes, faceDeliveryLabel } from "./facePhoto";

const mocks = vi.hoisted(() => ({ permitted: true, enabled: true, loading: false, registered: false, active: true, busy: false, hasDevice: true, target: true, delivery: "unknown", hook: 0, overrides: new Map<number, unknown>(), query: vi.fn(), save: vi.fn(), capture: vi.fn(), resend: vi.fn(), remove: vi.fn(), confirmDelete: undefined as (() => Promise<unknown>) | undefined, statuses: [] as string[], actions: [] as (() => Promise<unknown>)[] }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => permission === "biometrics.manage" && mocks.permitted }) }));
vi.mock("react", async original => {
  const react = await original<typeof import("react")>();
  return { ...react, useState: (initial: unknown) => {
    const index = mocks.hook++;
    return [mocks.overrides.has(index) ? mocks.overrides.get(index) : initial, (value: unknown) => { if (typeof value === "string") mocks.statuses.push(value); }];
  } };
});
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref); mocks.query(name, args);
    if (name.includes("getEmployeeBiometricModule")) return { enabled: mocks.enabled };
    if (mocks.loading) return undefined;
    return { registered: mocks.registered, active: mocks.active, busy: mocks.busy, devices: mocks.hasDevice ? [{ _id: "device", name: "Panel", target: mocks.target, status: mocks.delivery, operation: mocks.delivery === "failed" ? "deleteFace" : "addFace", error: mocks.delivery === "failed" ? "offline" : null }] : [] };
  },
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).includes("savePhoto") ? mocks.save : mocks.capture,
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref).includes("resend") ? mocks.resend : mocks.remove,
}));
vi.mock("@/hooks/useAsyncAction", () => ({ useAsyncAction: (action: () => Promise<unknown>) => { mocks.actions.push(action); return { run: action, pending: false }; } }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: ({ onConfirm }: { onConfirm: () => Promise<unknown> }) => { mocks.confirmDelete = onConfirm; return null; } }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ open, children }: { open: boolean; children?: ReactNode }) => open ? <div>{children}</div> : null, DialogContent: Part, DialogDescription: Part, DialogFooter: Part, DialogHeader: Part, DialogTitle: Part };
});
function render(cardNumber: string | undefined = "123") { mocks.hook = 0; return renderToStaticMarkup(<EmployeeFaceCard employeeId={"employee" as Id<"employees">} cardNumber={cardNumber} />); }
beforeEach(() => { vi.clearAllMocks(); Object.assign(mocks, { permitted: true, enabled: true, loading: false, registered: false, active: true, busy: false, hasDevice: true, target: true, delivery: "unknown", hook: 0, statuses: [], actions: [] }); mocks.overrides.clear(); });

it("biyometri yetkisi veya modül yokken yüz metadata sorgusunu çalıştırmaz", () => {
  mocks.permitted = false; expect(render()).toBe("");
  expect(mocks.query).toHaveBeenCalledWith("privacyBiometric:getEmployeeBiometricModule", "skip");
  expect(mocks.query).not.toHaveBeenCalledWith("employeeFaces:listForEmployee", expect.anything());
  mocks.permitted = true; mocks.enabled = false; expect(render()).toBe("");
});
it("merkezi kayıt ve cihazdaki bilinmeyen durumu profil fotoğrafından ayrı gösterir", () => {
  const html = render();
  for (const text of ["Kayıtlı yüz yok.", "profil fotoğrafından ayrıdır", "Cihazdaki kayıt doğrulanmadı", "Panel", "JPEG, en fazla 200 KB"]) expect(html).toContain(text);
});
it.each(["", "  "])("kartsız kişide açıklama gösterir ve yüz ekleme kontrollerini kapatır: %j", cardNumber => {
  const html = render(cardNumber);
  expect(html).toContain("Yüz eklemek için önce kart atayın");
  expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled=""/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Fotoğrafı kaydet<\/button>/);
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cihazdan yüz al<\/button>/);
});
it("kart prop'u eksikse kartsız kabul eder", () => {
  mocks.hook = 0;
  const html = renderToStaticMarkup(<EmployeeFaceCard employeeId={"employee" as Id<"employees">} />);
  expect(html).toContain("Yüz eklemek için önce kart atayın");
  expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Cihazdan yüz al<\/button>/);
});
it.each(["capture", "upload"])("kart kaldırılınca açık %s onayı cihaz/yükleme çağrısı yapmaz", async mode => {
  mocks.overrides.set(0, { name: "face.jpg", arrayBuffer: vi.fn() });
  mocks.overrides.set(3, mode);
  render("");
  await mocks.actions[0]();
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.save).not.toHaveBeenCalled();
});
it("kartlı kişide kartsızlık açıklaması göstermez ve cihazdan eklemeyi açar", () => {
  const html = render(" 00123 ");
  expect(html).not.toContain("Yüz eklemek için önce kart atayın");
  const button = html.match(/<button[^>]*>Cihazdan yüz al<\/button>/)?.[0];
  expect(button).toBeDefined();
  expect(button).not.toContain('disabled=""');
});
it("yükleme ve boş hedef durumlarını gösterir", () => {
  mocks.loading = true; expect(render()).toContain("Yüz bilgileri yükleniyor");
  mocks.loading = false; mocks.hasDevice = false; expect(render()).toContain("Yüz gönderilecek cihaz yok.");
});
it("başarısız silmeyi görünür kılar; yeni kayıt öncesi tekrar denemeyi sunar", () => {
  mocks.delivery = "failed";
  const html = render(); expect(html).toContain("Silme başarısız"); expect(html).toContain("offline"); expect(html).toContain("Cihazlardan silmeyi yeniden dene");
});
it("N6: önceki hedefin silme hatası yeni yüz kaydını arayüzde kilitlemez", () => {
  mocks.delivery = "failed"; mocks.target = false;
  const html = render();
  expect(html).toContain("Önceki hedef"); expect(html).toContain("Silme başarısız");
  expect(html).not.toContain("Yeni kayıttan önce başarısız cihaz silme işlemini yeniden deneyin.");
  expect(html.match(/<input[^>]*type="file"[^>]*>/)?.[0]).not.toContain(' disabled=""');
});
it("capture kişi ve seçili cihazla çağrılır; fotoğraf yüz kaydı olarak saklanır", async () => {
  mocks.overrides.set(3, "capture"); mocks.capture.mockResolvedValue({ ok: true, faceDataBase64: "/9gK/9k=" });
  render(); await mocks.actions[0]();
  expect(mocks.capture).toHaveBeenCalledWith({ employeeId: "employee", deviceId: "device" });
  expect(mocks.save).toHaveBeenCalledWith({ employeeId: "employee", bytes: new Uint8Array([255, 216, 10, 255, 217]).buffer });
  expect(mocks.statuses).toContain("Yüz kaydı saklandı; erişim kapsamındaki cihazlara gönderiliyor.");
});
it("capture hata/URL-only sonucunu saklamaz; JPEG yüklemeyi önerir", async () => {
  mocks.overrides.set(3, "capture"); mocks.capture.mockResolvedValue({ ok: true, faceURL: "http://device/private.jpg" });
  render(); await expect(mocks.actions[0]()).rejects.toThrow("JPEG fotoğraf yükleyerek"); expect(mocks.save).not.toHaveBeenCalled();
});
it("dosya yüklemede profil fotoğrafı endpointine dokunmaz", async () => {
  const bytes = new Uint8Array([255, 216, 10, 255, 217]).buffer;
  mocks.overrides.set(0, { name: "face.jpg", arrayBuffer: async () => bytes }); mocks.overrides.set(3, "upload");
  render(); await mocks.actions[0]();
  expect(mocks.save).toHaveBeenCalledWith({ employeeId: "employee", bytes }); expect(mocks.capture).not.toHaveBeenCalled();
});
it("silme onayı hata durumunda reddedilir, başarıda merkezi ve cihaz durumunu açıklar", async () => {
  mocks.registered = true; render(); mocks.remove.mockRejectedValueOnce(new Error("offline"));
  await expect(mocks.confirmDelete?.()).rejects.toThrow("offline");
  mocks.remove.mockResolvedValueOnce(null); await mocks.confirmDelete?.();
  expect(mocks.remove).toHaveBeenCalledWith({ employeeId: "employee" });
  expect(mocks.statuses).toContain("Merkezi yüz kaydı silindi; cihazlardan silme durumu aşağıda izlenebilir.");
});
it("base64 ve durum etiketleri bozuk/veri boyutu sınırlarını korur", () => {
  expect(() => capturedFaceBytes({ ok: false, error: "offline" })).toThrow("offline");
  expect(() => capturedFaceBytes({ ok: true, faceDataBase64: "%%%" })).toThrow("geçerli");
  expect(() => capturedFaceBytes({ ok: true, faceDataBase64: "A".repeat(300000) })).toThrow("200 KB");
  expect(faceDeliveryLabel({ status: "done", operation: "addFace" })).toBe("Yüz teslim edildi");
  expect(faceDeliveryLabel({ status: "done", operation: "deleteFace" })).toBe("Silme teslim edildi");
});
