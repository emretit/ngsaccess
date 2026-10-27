import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountAccessBadges, AccountAccessDialog } from "./AccountAccessActions";
import type { User } from "../types/user-types";

const user: User = {
  _id: "user" as User["_id"], displayName: "Kullanıcı", email: "", role: "viewer",
  disabledAt: undefined, accessExpiresAt: undefined, setupExpiresAt: undefined,
  projects: [], isSelf: false, canResetPassword: false, pendingSetup: false, accessExpired: false,
};
describe("account access badges", () => {
  it("shows frozen and expired states together", () => {
    const html = renderToStaticMarkup(<AccountAccessBadges user={{ ...user, disabledAt: 0, accessExpiresAt: 0, accessExpired: true }} />);
    expect(html).toContain("Donduruldu");
    expect(html).toContain("Erişim bitti");
  });
  it("formats expiry in Istanbul independently of the browser timezone", () => {
    const html = renderToStaticMarkup(<AccountAccessBadges user={{ ...user, accessExpiresAt: Date.parse("2030-01-02T10:30:00Z") }} />);
    expect(html).toContain("Bitiş:");
    expect(html).toContain("13:30");
  });
  it("preserves legacy users without access fields", () => {
    const html = renderToStaticMarkup(<AccountAccessBadges user={user} />);
    expect(html).not.toContain("Donduruldu");
    expect(html).not.toContain("Bitiş:");
  });
});

const state = vi.hoisted(() => ({ save: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => state.save }));
vi.mock("@/lib/notify", () => ({ notify: { success: state.success, error: state.error } }));
function controls(onClose: () => void, mode: "freeze" | "expiry" = "freeze") {
  let result: React.ReactNode;
  function Harness() { result = AccountAccessDialog({ user: { ...user, accessExpiresAt: Date.parse("2030-01-02T10:30:00Z") }, mode, onClose }); return null; }
  renderToStaticMarkup(<Harness />);
  function elements(node: React.ReactNode): React.ReactElement<Record<string, unknown>>[] {
    return React.Children.toArray(node).flatMap(child => React.isValidElement<{ children?: React.ReactNode }>(child) ? [child as React.ReactElement<Record<string, unknown>>, ...elements(child.props.children)] : []);
  }
  return elements(result);
}
async function flushAction() {
  for (let index = 0; index < 10; index++) await Promise.resolve();
}
beforeEach(() => { state.save.mockReset().mockResolvedValue(null); state.success.mockClear(); state.error.mockClear(); });
describe("hesap erişim dialog işlemleri", () => {
  it.each(["freeze", "expiry"] as const)("%s hata halinde açık kalır ve başarıda kapanır", async mode => {
    const onClose = vi.fn();
    const submit = async () => {
      const button = controls(onClose, mode).find(element => element.props.children === (mode === "freeze" ? "Dondur" : "Kaydet"));
      (button?.props.onClick as () => void)();
      await flushAction();
    };
    const error = new Error("network");
    state.save.mockRejectedValueOnce(error);
    await submit();
    expect(onClose).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledExactlyOnceWith("İşlem tamamlanamadı", error);
    expect(state.success).not.toHaveBeenCalled();
    await submit();
    expect(onClose).toHaveBeenCalledOnce();
    expect(state.success).toHaveBeenCalledExactlyOnceWith("Kullanıcı erişimi güncellendi");
  });
  it("aynı handler tekrar çağrıldığında yalnız bir istek ve kapanış üretir", async () => {
    let resolve: (() => void) | undefined;
    state.save.mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
    const onClose = vi.fn();
    const button = controls(onClose).find(element => element.props.children === "Dondur");
    const submit = button?.props.onClick as () => Promise<void>;
    const pending = submit();
    await submit();
    expect(state.save).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    resolve?.(); await pending; await flushAction();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
