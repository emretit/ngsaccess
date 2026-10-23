import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfirmDestructiveProps } from "@/components/shared/ConfirmDestructive";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceApiTokenCard } from "./DeviceApiTokenCard";

const mocks = vi.hoisted(() => ({ regenerate: vi.fn(), error: vi.fn(), success: vi.fn(), confirm: null as ConfirmDestructiveProps | null, click: undefined as (() => Promise<void>) | undefined }));
vi.mock("convex/react", () => ({ useMutation: () => mocks.regenerate }));
vi.mock("@/lib/notify", () => ({ notify: { error: mocks.error, success: mocks.success } }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: (props: ConfirmDestructiveProps) => { mocks.confirm = props; return null; } }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: Part, AlertDialogCancel: Part, AlertDialogContent: Part, AlertDialogDescription: Part, AlertDialogFooter: Part, AlertDialogHeader: Part, AlertDialogTitle: Part };
});
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick }: { children?: ReactNode; onClick?: () => Promise<void> }) => { mocks.click = onClick; return <button>{children}</button>; } }));
const render = () => renderToStaticMarkup(<DeviceApiTokenCard deviceId={"d" as Id<"devices">} currentToken="secret-prefix-and-suffix" currentTokenCreatedAt="2026-10-19T00:00:00Z" />);
beforeEach(() => { vi.clearAllMocks(); mocks.confirm = null; });
describe("cihaz bağlantı anahtarı", () => {
  it("anahtarı tamamen maskeler ve Türkiye saatini gösterir", () => {
    const html = render();
    expect(html).toContain("••••••••");
    expect(html).not.toContain("secret");
    expect(html).not.toContain("suffix");
    expect(html).toContain("19.10.2026 03:00");
    expect(html).not.toContain("Teknik ayrıntı");
  });
  it("yenileme reddedilirse onay sözleşmesi için hatayı yeniden fırlatır", async () => {
    const failure = new Error("Bağlantı kesildi");
    mocks.regenerate.mockRejectedValue(failure);
    render();
    await expect(mocks.confirm?.onConfirm()).rejects.toBe(failure);
    expect(mocks.regenerate).toHaveBeenCalledWith({ deviceId: "d" });

    expect(mocks.success).not.toHaveBeenCalled();
  });
  it("başarılı yenilemede yeni anahtarın uygulanmasını bildirir", async () => {
    mocks.regenerate.mockResolvedValue({ token: "new-key" });
    render();
    await mocks.confirm?.onConfirm();
    expect(mocks.success).toHaveBeenCalledWith("Yeni anahtar oluşturuldu", expect.any(String));
    expect(mocks.error).not.toHaveBeenCalled();
  });
});

it("failed regeneration uses the real confirmation guard, notifies the user and leaves the dialog open", async () => {
  const failure = new Error("Bağlantı kesildi");
  mocks.regenerate.mockRejectedValue(failure);
  render();
  const confirm = mocks.confirm;
  if (!confirm) throw new Error("Missing confirmation");
  const { ConfirmDestructive } = await vi.importActual<typeof import("@/components/shared/ConfirmDestructive")>("@/components/shared/ConfirmDestructive");
  const change = vi.fn();
  renderToStaticMarkup(<ConfirmDestructive {...confirm} open onOpenChange={change} />);
  await mocks.click?.();
  expect(mocks.regenerate).toHaveBeenCalledWith({ deviceId: "d" });
  expect(mocks.error).toHaveBeenCalledWith("İşlem tamamlanamadı", failure);
  expect(change).not.toHaveBeenCalled();
});
