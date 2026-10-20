import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  CorrectionRequestsPanel,
  CorrectionRequestsEntry,
  requestsCursor,
} from "./CorrectionRequestsPanel";
const state = vi.hoisted(() => ({ result: undefined as unknown }));
vi.mock("convex/react", () => ({
  useQuery: () => state.result,
  useMutation: () => vi.fn(),
}));
const render = () =>
  renderToStaticMarkup(
    <CorrectionRequestsPanel projectId={"project-1" as Id<"projects">} />,
  );
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
        <CorrectionRequestsEntry projectId={"project-1" as Id<"projects">} />,
      );
    state.result = { count: 100, capped: false };
    expect(entry()).toContain("Düzeltme talepleri (100)");
    state.result = { count: 101, capped: true };
    expect(entry()).toContain("Düzeltme talepleri (100+)");
  });
});
