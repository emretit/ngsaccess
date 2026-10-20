import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { LeaveRequestsPanel, requestsCursor } from "./LeaveRequestsPanel";
const state = vi.hoisted(() => ({ result: undefined as unknown }));
vi.mock("convex/react", () => ({
  useQuery: () => state.result,
  useMutation: () => vi.fn(),
}));
const render = () =>
  renderToStaticMarkup(
    <LeaveRequestsPanel projectId={"project-1" as Id<"projects">} />,
  );
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
          leaveType: "annual",
          startDate: "2026-10-21",
          endDate: "2026-10-22",
          calendarDays: null,
          notes: "Aile ziyareti",
          departmentName: "Operasyon",
        },
      ],
      isDone: false,
      continueCursor: "next",
    };
    const html = render();
    expect(html).toContain(">—</td>");
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
