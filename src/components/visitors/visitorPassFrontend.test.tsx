import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Children, isValidElement, type ReactNode } from "react";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { useVisitorFormSubmit } from "./hooks/useVisitorFormSubmit";
import type { VisitorFormData } from "./hooks/useVisitorFormData";
import { visitorFormPayload } from "./lib/formPayload";
import { VisitorPassCard } from "./VisitorPassCard";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), issue: vi.fn(), send: vi.fn(), saved: vi.fn(), error: vi.fn(), success: vi.fn(),
  state: [] as unknown[], cursor: 0,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.state)) mocks.state[index] = initial;
    return [mocks.state[index], (value: unknown) => { mocks.state[index] = value; }];
  },
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "visitorPasses:issue" ? mocks.issue : mocks.create,
  useAction: () => mocks.send,
  useQuery: () => undefined,
}));
vi.mock("@/lib/notify", () => ({ notify: { success: mocks.success, error: mocks.error } }));

const form: VisitorFormData = {
  firstName: "Ada", lastName: "Ziyaretçi", visitorPhone: "", visitorCompany: "", visitPurpose: "", hostEmployeeId: null,
  cardNumber: "", credential: "pass", maxUses: "1", email: "ada@example.com", selected_doors: ["door"], selected_devices: [],
  accessExpiresAt: "2099-01-01T18:00", isActive: true, notes: "", kvkkConsent: false, projectId: "project" as Id<"projects">,
};
const secret = { passId: "pass" as Id<"visitorPasses">, token: "NGSV1.abcdefghijklmnopqrstuv", pin: "012345" };
function deliveryAction(label: string, onClose = vi.fn()) {
  let tree: ReactNode = null;
  function Harness() {
    tree = VisitorPassCard({ visitorId: "visitor" as Id<"employees">, name: "Ada", secret, onClose });
    return null;
  }
  renderToStaticMarkup(<Harness />);
  function find(node: ReactNode): (() => void) | undefined {
    if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return;
    if (node.props.children === label) return node.props.onClick;
    for (const child of Children.toArray(node.props.children)) {
      const found = find(child);
      if (found) return found;
    }
  }
  const action = find(tree);
  if (!action) throw new Error(`Missing action: ${label}`);
  return action;
}
function hook() {
  mocks.cursor = 0;
  let value: ReturnType<typeof useVisitorFormSubmit> | undefined;
  function Harness() { value = useVisitorFormSubmit(null, mocks.saved); return null; }
  renderToStaticMarkup(<Harness />);
  if (!value) throw new Error("Hook not initialized");
  return value;
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.state = []; mocks.cursor = 0;
  mocks.create.mockResolvedValue("visitor"); mocks.issue.mockResolvedValue(secret);
});

describe("ziyaretçi pass formu", () => {
  it("kart istemeden pass oluşturur ve teslim ekranı kapanana kadar kayıt panelini açık tutar", async () => {
    expect(await hook().handleSubmit(form)).toBe(true);
    expect(mocks.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ credential: "pass", cardNumber: undefined, email: "ada@example.com" }));
    expect(mocks.issue).toHaveBeenCalledExactlyOnceWith({ visitorId: "visitor", maxUses: 1 });
    expect(hook().issued).toEqual({ visitorId: "visitor", secret });
    expect(mocks.saved).not.toHaveBeenCalled();
  });

  it("sınırsız giriş için maxUses göndermez", async () => {
    await hook().handleSubmit({ ...form, maxUses: "" });
    expect(mocks.issue).toHaveBeenCalledWith({ visitorId: "visitor" });
  });

  it("kod üretimi hata verirse tekrar denemede ikinci ziyaretçi oluşturmaz", async () => {
    mocks.issue.mockRejectedValueOnce(new Error("temporary failure"));
    expect(await hook().handleSubmit(form)).toBe(false);
    expect(hook().savedId).toBe("visitor");
    expect(await hook().handleSubmit(form)).toBe(true);
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.issue).toHaveBeenCalledTimes(2);
    expect(hook().issued?.secret.pin).toBe("012345");
  });

  it.each(["0", "-1", "1.5", "abc", "9007199254740992"])("geçersiz limiti kaydetmeden reddeder: %s", maxUses => {
    expect(() => visitorFormPayload({ ...form, maxUses })).toThrow();
  });

  it("teslimde ad, kapı, geçerlilik, baştaki sıfırlı PIN ve A6 yazdırma sunar", () => {
    const html = renderToStaticMarkup(<VisitorPassCard visitorId={"visitor" as Id<"employees">} name="Ada Ziyaretçi" expiresAt="2099-01-01T15:00:00Z" doors="Lobi, Bahçe" secret={secret} onClose={vi.fn()} />);
    expect(html).toContain("Ada Ziyaretçi"); expect(html).toContain("Lobi, Bahçe"); expect(html).toContain("012345");
    expect(html).toContain("A6 portrait"); expect(html).toContain("E-posta gönder"); expect(html).toContain("Yazdır");
    expect(html).toContain("bir kez gösterilir");
    expect(html).not.toContain("localStorage");
  });

  it.each([
    ["NO_EMAIL", "e-posta adresi bulunmuyor"],
    ["MAIL_NOT_CONFIGURED", "e-posta ayarları yapılandırılmamış"],
  ])("e-posta hatasını Türkçe gösterir: %s", async (reason, message) => {
    mocks.send.mockResolvedValue({ ok: false, reason });
    deliveryAction("E-posta gönder")();
    await vi.waitFor(() => expect(mocks.error).toHaveBeenCalledWith("E-posta gönderilemedi", expect.objectContaining({ message: expect.stringContaining(message) })));
    expect(mocks.send).toHaveBeenCalledWith({ visitorId: "visitor", token: secret.token, pin: secret.pin });
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("teslim ekranını kapatma işlemini sahibine iletir", () => {
    const onClose = vi.fn();
    deliveryAction("Kodu kapat", onClose)();
    expect(onClose).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
