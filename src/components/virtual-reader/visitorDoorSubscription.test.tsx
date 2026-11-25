import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { ReaderScreen } from "@/pages/VirtualReaderKiosk";

const mocks = vi.hoisted(() => ({
  phase: { kind: "idle" } as unknown,
  status: undefined as unknown,
  query: vi.fn(), scan: vi.fn(), onCode: undefined as ((code: string) => void) | undefined,
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    if (typeof initial === "object" && initial !== null && "kind" in initial) return [mocks.phase, (value: unknown) => { mocks.phase = value; }];
    return [typeof initial === "function" ? initial() : initial, vi.fn()];
  },
}));
vi.mock("convex/react", () => ({
  useQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => { mocks.query(getFunctionName(reference), args); return mocks.status; },
  useMutation: () => mocks.scan,
}));
vi.mock("./useQrCamera", () => ({
  useQrCamera: (_video: unknown, _facing: unknown, onCode: (code: string) => void) => { mocks.onCode = onCode; return "running"; },
  useScreenWakeLock: vi.fn(),
}));
vi.mock("@/hooks/useNow", () => ({ useNow: () => new Date("2026-11-25T12:00:00Z") }));
vi.mock("@/components/ui/logo", () => ({ default: () => <span>Logo</span> }));

const operationId = "operation";
const presentation = { tone: "success", title: "Ziyaretçi Ada", detail: "Giriş kaydedildi" };
const resultPhase = { kind: "result", presentation, operationId };
function render() {
  return renderToStaticMarkup(<ReaderScreen token="reader-secret" reader={{ name: "Lobi", isActive: true, projectName: "Proje" }} onReaderInvalid={vi.fn()} />);
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.phase = { kind: "idle" }; mocks.status = undefined;
  vi.stubGlobal("localStorage", { getItem: () => null });
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("kiosk kapı sonucu aboneliği", () => {
  it("pending okutmanın operationId değerini sonuç ekranına taşır", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", { setTimeout, clearTimeout });
    mocks.scan.mockResolvedValue({ status: "granted", employeeName: "Ziyaretçi Ada", direction: "entry", accessTime: "2026-11-25T12:00:00Z", doorOpen: "pending", doorOpenOperationId: operationId });
    render(); mocks.onCode?.("NGSV1.abcdefghijklmnopqrstuv");
    await vi.waitFor(() => expect(mocks.phase).toMatchObject({ kind: "result", operationId }));
    render();
    expect(mocks.query).toHaveBeenLastCalledWith("mobileAccess:visitorDoorOpenStatus", { readerToken: "reader-secret", operationId });
    await vi.advanceTimersByTimeAsync(3500);
    render();
    expect(mocks.phase).toEqual({ kind: "idle" });
    expect(mocks.query).toHaveBeenLastCalledWith("mobileAccess:visitorDoorOpenStatus", "skip");
  });

  it.each([undefined, { doorOpen: "pending" }])("sonuç yüklenirken ve pending iken bekliyor göstergesini sunar", status => {
    mocks.phase = resultPhase; mocks.status = status;
    const html = render();
    expect(html).toContain("Kapının açılması bekleniyor…");
    expect(html).toContain("animate-spin");
    expect(html).toContain("Ziyaretçi Ada");
  });

  it("abonelikte gelen confirmed ve failed değerlerini aynı sonuçta gösterir", () => {
    mocks.phase = resultPhase; mocks.status = { doorOpen: "confirmed" };
    expect(render()).toContain("Kapı açıldı");
    mocks.status = { doorOpen: "failed" };
    const html = render();
    expect(html).toContain("Kapı açılamadı — resepsiyona başvurun");
    expect(html).toContain('role="alert"');
  });

  it("durum sorgusu null dönerse başarı iddia etmez", () => {
    mocks.phase = resultPhase; mocks.status = null;
    expect(render()).toContain("Kapı açılamadı — resepsiyona başvurun");
  });

  it.each([{ kind: "idle" }, { kind: "checking" }, { kind: "result", presentation }])("sonuç dışında ve operationId yokken abone olmaz: %j", phase => {
    mocks.phase = phase;
    render();
    expect(mocks.query).toHaveBeenLastCalledWith("mobileAccess:visitorDoorOpenStatus", "skip");
  });
});
