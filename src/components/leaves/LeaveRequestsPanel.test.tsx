import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  LeaveRequestsPanel,
    requestsCursor,
} from "./LeaveRequestsPanel";
const state = vi.hoisted(() => ({
  result: undefined as unknown,
  decision: null as { id: string; approve: boolean } | null,
  note: "", hook: 0, busy: false,
  setDecision: vi.fn(), setNote: vi.fn(),
  onOpenChange: undefined as undefined | ((open: boolean) => void),
  submit: undefined as undefined | ((event: { preventDefault: () => void }) => Promise<void>),
  approve: vi.fn(), reject: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock("react", async importOriginal => {
  const original = await importOriginal<typeof import("react")>();
  return { ...original, useState: (initial: unknown) => {
    const index = state.hook++;
    if (state.decision && index === 1) return [state.decision, state.setDecision];
    if (state.decision && index === 2) return [state.note, state.setNote];
    if (state.decision && index === 3) return [state.busy, vi.fn()];
    return original.useState(initial);
  } };
});
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ children, onOpenChange }: { children: import("react").ReactNode; onOpenChange: typeof state.onOpenChange }) => { state.onOpenChange = onOpenChange; return <div>{children}</div>; }, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box, DialogFooter: Box,
    DialogContent: ({ children }: { children: import("react").ReactElement<{ onSubmit: typeof state.submit }> }) => {
      state.submit = children.props.onSubmit;
      return <div>{children}</div>;
    },
  };
});
vi.mock("@/lib/notify", () => ({ notify: { success: state.success, error: state.error } }));
vi.mock("convex/react", () => ({
  useQuery: () => state.result,
  useMutation: (ref: unknown) => getFunctionName(ref as FunctionReference<"mutation">) === "leaveRequests:approve" ? state.approve : state.reject,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>,
}));
const render = () => {
  state.hook = 0;
  return renderToStaticMarkup(
    <LeaveRequestsPanel projectId={"project-1" as Id<"projects">} />,
  );
};
describe("LeaveRequestsPanel", () => {
  it("returns to the first page when the last request on a later page disappears", () => {
    expect(requestsCursor("page-2", 1)).toBe("page-2");
    expect(requestsCursor("page-2", 0)).toBeNull();
    expect(requestsCursor("page-2", undefined)).toBe("page-2");
    expect(requestsCursor(null, 0)).toBeNull();
  });
  it("shows loading and the empty queue", () => {
    state.result = undefined;
    expect(render()).toContain("Talepler yükleniyor.");
    state.result = { page: [], isDone: true, continueCursor: "" };
    expect(render()).toContain("Bekleyen izin talebi yok.");
  });
  it("renders request details and decision controls", () => {
    state.result = {
      page: [
        {
          _id: "request-1",
          employeeName: "Ada Yılmaz",
          createdAt: "2026-10-20T09:00:00Z",
          leaveType: "annual", startDate: "2026-10-21", endDate: "2026-10-22",
          calendarDays: null, notes: "Aile ziyareti", departmentName: "Operasyon",
        },
      ],
      isDone: false,
      continueCursor: "next",
    };
    const html = render();
    for (const label of [
      "Ada Yılmaz",
      "Onayla",
      "Reddet",
      "Sonraki sayfa",
      "Aile ziyareti",
      "Operasyon",
      "21.10.2026",
    ])
      expect(html).toContain(label);
  });

});

describe("panel karar gönderimi", () => {
  it.each([true, false])("onay=%s doğru mutation ile notu gönderir", async approve => {
    state.result = { page: [], isDone: true, continueCursor: "" };
    state.decision = { id: "request-1", approve }; state.note = "  Karar gerekçesi  ";
    state.approve.mockReset(); state.reject.mockReset(); state.success.mockClear();
    render();
    expect(state.submit).toBeDefined();
    await state.submit?.({ preventDefault: vi.fn() });
    expect(approve ? state.approve : state.reject).toHaveBeenCalledWith({ leaveId: "request-1", note: "Karar gerekçesi" });
    expect(state.success).toHaveBeenCalledWith(approve ? "Talep onaylandı" : "Talep reddedildi");
    state.decision = null;
  });
  it("kısa red gerekçesini göndermez, sunucu hatasını kullanıcıya gösterir", async () => {
    state.decision = { id: "request-1", approve: false }; state.note = "Az";
    state.reject.mockReset(); state.error.mockClear();
    render(); await state.submit?.({ preventDefault: vi.fn() });
    expect(state.reject).not.toHaveBeenCalled();
    state.note = "Geçerli gerekçe";
    const error = new Error("Bu işlem için yetkiniz yok");
    state.reject.mockRejectedValueOnce(error);
    render(); await state.submit?.({ preventDefault: vi.fn() });
    expect(state.error).toHaveBeenCalledWith("Talep sonuçlandırılamadı", error);
    state.decision = null;
  });
});

describe("karar dialog yaşam döngüsü", () => {
  it.each([true, false])("onay=%s hatasında karar ve not korunur, başarıda kapanır", async approve => {
    state.result = { page: [], isDone: true, continueCursor: "" };
    state.decision = { id: "request-1", approve };
    state.note = "  Kullanıcının karar notu  ";
    state.setDecision.mockClear(); state.setNote.mockClear();
    state.success.mockClear(); state.error.mockClear();
    const mutation = approve ? state.approve : state.reject;
    mutation.mockReset().mockRejectedValueOnce(new Error("network"));
    render();
    await state.submit?.({ preventDefault: vi.fn() });
    expect(state.setDecision).not.toHaveBeenCalled();
    expect(state.setNote).not.toHaveBeenCalled();
    expect(state.error).toHaveBeenCalledOnce();
    expect(state.success).not.toHaveBeenCalled();
    mutation.mockResolvedValueOnce(null);
    render();
    await state.submit?.({ preventDefault: vi.fn() });
    expect(state.setDecision).toHaveBeenCalledWith(null);
    expect(state.success).toHaveBeenCalledOnce();
    expect(mutation).toHaveBeenLastCalledWith({ leaveId: "request-1", note: "Kullanıcının karar notu" });
    state.decision = null;
  });
  it("art arda gönderim tek mutation üretir ve pending dialog kapanmaz", async () => {
    state.result = { page: [], isDone: true, continueCursor: "" };
    state.decision = { id: "request-1", approve: false }; state.note = "Karar notu";
    let resolve: (() => void) | undefined;
    state.reject.mockReset().mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    state.setDecision.mockClear();
    render();
    const submit = state.submit;
    const first = submit?.({ preventDefault: vi.fn() });
    await submit?.({ preventDefault: vi.fn() });
    expect(state.reject).toHaveBeenCalledOnce();
    state.busy = true;
    const html = render();
    state.onOpenChange?.(false);
    expect(state.setDecision).not.toHaveBeenCalled();
    expect(html).toMatch(/<textarea[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Vazgeç/);
    expect(html).toContain("Kaydediliyor…");
    resolve?.(); await first;
    expect(state.setDecision).toHaveBeenCalledWith(null);
    state.busy = false; state.decision = null;
  });
});
