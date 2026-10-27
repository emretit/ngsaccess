import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import { createCardCaptureSession } from "./cardCaptureSession";
import { visitorFormSchema } from "./hooks/useVisitorFormSchema";
import VisitorCardCapture from "./VisitorCardCapture";
import { BatchCardAssignDialog } from "../employees/import/BatchCardAssignDialog";

type Effect = { deps?: readonly unknown[]; cleanup?: () => void };
const ui = vi.hoisted(() => ({
  states: [] as unknown[], refs: [] as { current: unknown }[], effects: [] as Effect[],
  pending: [] as (() => void)[], stateIndex: 0, refIndex: 0, effectIndex: 0,
  buttons: [] as { label: string; click: () => void }[],
  select: undefined as ((value: string) => void) | undefined,
  queryArgs: undefined as unknown, start: vi.fn<() => Promise<string>>(),
  reading: undefined as { cardNo: string; accessTime: string } | undefined,
}));

// SSR hook harness: drive real event handlers/effects without a browser or DOM.
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = ui.stateIndex++;
    if (!(index in ui.states)) ui.states[index] = typeof initial === "function" ? initial() : initial;
    return [ui.states[index], (value: unknown) => { ui.states[index] = typeof value === "function" ? value(ui.states[index]) : value; }];
  },
  useRef: (initial: unknown) => {
    const index = ui.refIndex++;
    ui.refs[index] ??= { current: initial };
    return ui.refs[index];
  },
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
    const index = ui.effectIndex++;
    const previous = ui.effects[index];
    if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps?.[i]))) {
      ui.pending.push(() => {
        previous?.cleanup?.();
        const cleanup = effect();
        ui.effects[index] = { deps, cleanup: typeof cleanup === "function" ? cleanup : undefined };
      });
    }
  },
}));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "cardReadings:startCardCapture" ? ui.start : vi.fn(),
  useAction: () => vi.fn(),
  useQuery: (_ref: unknown, args: unknown) => { ui.queryArgs = args; return ui.reading; },
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project" }) }));
vi.mock("@/hooks/useDevices", () => ({ useDevices: () => ({ devices: [
  { _id: "reader-a", name: "A", deviceType: "Kart Okuyucu" },
  { _id: "reader-b", name: "B", deviceType: "Kart Okuyucu" },
] }) }));
vi.mock("@/components/ui/select", () => {
  const Part = ({ children }: { children?: ReactNode }) => children;
  return { Select: ({ onValueChange, children }: { onValueChange: (value: string) => void; children?: ReactNode }) => { ui.select = onValueChange; return children; }, SelectContent: Part, SelectItem: Part, SelectTrigger: Part, SelectValue: () => null };
});
vi.mock("@/components/ui/native-select", () => ({ NativeSelect: ({ onChange }: { onChange: (event: { target: { value: string } }) => void }) => { ui.select = value => onChange({ target: { value } }); return null; } }));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick }: { children?: ReactNode; onClick: () => void }) => {
  ui.buttons.push({ label: (Array.isArray(children) ? children : [children]).filter(child => typeof child === "string").join("").trim(), click: onClick });
  return children;
} }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: () => null }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => children;
  return { Dialog: Part, DialogContent: Part, DialogDescription: Part, DialogHeader: Part, DialogTitle: Part };
});

function render(element: ReactNode) {
  ui.stateIndex = 0; ui.refIndex = 0; ui.effectIndex = 0; ui.buttons = [];
  const html = renderToStaticMarkup(element);
  const pending = ui.pending.splice(0);
  for (const effect of pending) effect();
  return html;
}
async function click(label: string) {
  const button = ui.buttons.find(item => item.label === label);
  if (!button) throw new Error(`Button missing: ${label}`);
  button.click();
  await Promise.resolve();
}

beforeEach(() => {
  ui.states = []; ui.refs = []; ui.effects = []; ui.pending = []; ui.reading = undefined;
  ui.start.mockReset().mockResolvedValue("2026-10-27T12:00:00.000Z");
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", { getItem: () => "reader-a", setItem: vi.fn(), removeItem: vi.fn() });
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});
afterEach(() => {
  for (const effect of ui.effects) effect.cleanup?.();
  vi.unstubAllGlobals(); vi.useRealTimers();
});

describe("tek seferlik ziyaretçi kart yakalama", () => {
  it("A yakalandıktan sonra B ve tekrarlanan effect A'yı değiştirmez", () => {
    const session = createCardCaptureSession();
    expect(session.capture(undefined)).toBeNull();
    expect(session.capture("A")).toBe("A");
    expect(session.capture("B")).toBeNull();
    expect(session.capture("A")).toBeNull();
    session.rearm();
    expect(session.capture("B")).toBe("B");
  });
  it("iptal edilen veya yeni oturumdan eski kalan başlangıç yanıtını kabul etmez", () => {
    const session = createCardCaptureSession();
    const first = session.rearm();
    session.cancel();
    expect(session.isCurrent(first)).toBe(false);
    expect(session.capture("A")).toBeNull();
    const second = session.rearm();
    expect(session.isCurrent(first)).toBe(false);
    expect(session.isCurrent(second)).toBe(true);
  });
});

describe("kart okuyucu etkileşimleri", () => {
  it("tarayıcı saati ileri olsa da sunucu başlangıcını ve ziyaretçi seçeneğini sorguya geçirir", async () => {
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));
    const onCapture = vi.fn();
    const element = createElement(VisitorCardCapture, { onCapture });
    render(element);
    await click("Okumayı başlat");
    render(element);
    expect(ui.queryArgs).toMatchObject({ sinceTime: "2026-10-27T12:00:00.000Z", includeInactiveVisitorCards: true });
    ui.reading = { cardNo: "123", accessTime: "2026-10-27T11:58:00.000Z" };
    render(element);
    expect(onCapture).toHaveBeenCalledExactlyOnceWith("123");
  });
  it("zaman aşımından sonra okuyucu değişince uyarıyı ve yeniden dene etiketini temizler", async () => {
    const element = createElement(VisitorCardCapture, { onCapture: vi.fn() });
    render(element);
    await click("Okumayı başlat");
    render(element);
    vi.advanceTimersByTime(30000);
    expect(render(element)).toContain("30 saniyede kart okunmadı");
    ui.select?.("reader-b");
    const html = render(element);
    expect(html).not.toContain("30 saniyede kart okunmadı");
    expect(ui.buttons.some(button => button.label === "Okumayı başlat")).toBe(true);
    expect(ui.queryArgs).toBe("skip");
  });
  it("okuyucu değişince bekleyen sunucu yanıtı eski dinlemeyi açmaz", async () => {
    let resolve: ((value: string) => void) | undefined;
    ui.start.mockReturnValue(new Promise<string>(done => { resolve = done; }));
    const element = createElement(VisitorCardCapture, { onCapture: vi.fn() });
    render(element);
    await click("Okumayı başlat");
    ui.select?.("reader-b");
    render(element);
    resolve?.("2026-10-27T12:00:00.000Z");
    await Promise.resolve();
    render(element);
    expect(ui.queryArgs).toBe("skip");
  });
  it("başlatma hatası operatöre gösterilir ve yeniden başlatılabilir", async () => {
    ui.start.mockRejectedValueOnce(new Error("offline"));
    const element = createElement(VisitorCardCapture, { onCapture: vi.fn() });
    render(element);
    await click("Okumayı başlat");
    expect(render(element)).toContain("Okuma başlatılamadı");
    await click("Okumayı başlat");
    render(element);
    expect(ui.queryArgs).toMatchObject({ sinceTime: "2026-10-27T12:00:00.000Z" });
  });
  it("toplu kişi ataması sunucu saatini kullanır ve pasif ziyaretçi seçeneğini açmaz", async () => {
    vi.setSystemTime(new Date("2000-01-01T00:00:00.000Z"));
    const element = createElement(BatchCardAssignDialog, {
      open: true, onOpenChange: vi.fn(), projectId: "project" as Id<"projects">,
      employees: [{ _id: "person" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "test@example.invalid", cardNumber: "" }],
    });
    render(element);
    ui.select?.("reader-a");
    render(element);
    await click("Okut");
    render(element);
    expect(ui.queryArgs).toEqual({ projectId: "project", deviceId: "reader-a", sinceTime: "2026-10-27T12:00:00.000Z" });
  });
});

describe("ziyaretçi form hataları", () => {
  const valid = { firstName: "Ada", lastName: "Soyad", cardNumber: "123", presetRuleId: "zone", accessExpiresAt: "2099-10-16T18:00", isActive: true };
  it("iade edilmiş pasif kaydı yeni kart vermeden düzenler, aktivasyonda kart ister", () => {
    expect(visitorFormSchema.safeParse({ ...valid, isEditing: true, isActive: false, cardNumber: "" }).success).toBe(true);
    expect(visitorFormSchema.safeParse({ ...valid, isEditing: true, isActive: true, cardNumber: "" }).success).toBe(false);
    expect(visitorFormSchema.safeParse({ ...valid, isActive: false, cardNumber: "" }).success).toBe(false);
  });
  it.each([
    [{ presetRuleId: null }, "presetRuleId"],
    [{ accessExpiresAt: "2020-01-01T12:00" }, "accessExpiresAt"],
    [{ firstName: " " }, "firstName"],
    [{ cardNumber: "IADE:123:visitor" }, "cardNumber"],
    [{ cardNumber: "" }, "cardNumber"],
  ] as const)("alan hatasını ilgili alana bağlar: %j", (patch, field) => {
    const result = visitorFormSchema.safeParse({ ...valid, ...patch });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path[0] === field)).toBe(true);
  });
});
