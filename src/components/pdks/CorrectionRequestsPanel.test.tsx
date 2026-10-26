import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName, type FunctionReference } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  CorrectionRequestsPanel,
  CorrectionRequestsEntry,
  requestsCursor,
} from "./CorrectionRequestsPanel";
const state = vi.hoisted(() => ({
  result: undefined as unknown,
  decision: null as { id: string; approve: boolean } | null,
  note: "", hook: 0,
  submit: undefined as undefined | ((event: { preventDefault: () => void }) => Promise<void>),
  approve: vi.fn(), reject: vi.fn(), success: vi.fn(), error: vi.fn(),
}));
vi.mock("react", async importOriginal => {
  const original = await importOriginal<typeof import("react")>();
  return { ...original, useState: (initial: unknown) => {
    const index = state.hook++;
    if (state.decision && index === 1) return [state.decision, vi.fn()];
    if (state.decision && index === 2) return [state.note, vi.fn()];
    return original.useState(initial);
  } };
});
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box, DialogFooter: Box,
    DialogContent: ({ children }: { children: import("react").ReactElement<{ onSubmit: typeof state.submit }> }) => {
      state.submit = children.props.onSubmit;
      return <div>{children}</div>;
    },
  };
});
vi.mock("@/lib/notify", () => ({ notify: { success: state.success, error: state.error } }));
vi.mock("convex/react", () => ({
  useQuery: () => state.result,
  useMutation: (ref: unknown) => getFunctionName(ref as FunctionReference<"mutation">) === "attendanceCorrections:approve" ? state.approve : state.reject,
}));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenuItem: ({ children }: { children: import("react").ReactNode }) => <div>{children}</div>,
}));
const render = () => {
  state.hook = 0;
  return renderToStaticMarkup(
    <CorrectionRequestsPanel projectId={"project-1" as Id<"projects">} />,
  );
};
describe("CorrectionRequestsPanel", () => {
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
    expect(render()).toContain("Bekleyen düzeltme talebi yok.");
  });
  it("renders request details and decision controls", () => {
    state.result = {
      page: [
        {
          _id: "request-1",
          employeeName: "Ada Yılmaz",
          createdAt: "2026-10-20T09:00:00Z",
          date: "2026-10-19",
          correctionType: "both",
          requestedCheckIn: "09:00",
          requestedCheckOut: "18:00",
          reason: "Kartımı unuttum",
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
      "Kartımı unuttum",
      "09:00",
      "18:00",
      "Giriş ve çıkış",
    ])
      expect(html).toContain(label);
  });
  it("marks only the correction count above 100 with a plus", () => {
    const entry = () =>
      renderToStaticMarkup(
        <CorrectionRequestsEntry projectId={"project-1" as Id<"projects">} onSelect={() => undefined} />,
      );
    state.result = { count: 100, capped: false };
    expect(entry()).toContain(">100</div>");
    state.result = { count: 101, capped: true };
    expect(entry()).toContain(">100+</div>");
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
    expect(approve ? state.approve : state.reject).toHaveBeenCalledWith({ id: "request-1", note: "Karar gerekçesi" });
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
