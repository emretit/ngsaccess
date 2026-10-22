import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmployeeRecentReadings } from "./EmployeeRecentReadings";
const mocks = vi.hoisted(() => ({ result: null as unknown, query: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => { mocks.query(...args); return mocks.result; } }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project-a" }) }));
const employeeId = "employee-a" as Id<"employees">;
beforeEach(() => { vi.clearAllMocks(); mocks.result = null; });
it("02-O7/D1: requests five readings and links history with person and project filters", () => {
  mocks.result = [{ _id: "r1", accessTime: "2026-01-01T00:30:00Z", accessStatus: "izin_verildi", deviceName: "Kapı" }];
  const html = renderToStaticMarkup(<MemoryRouter><EmployeeRecentReadings employeeId={employeeId} /></MemoryRouter>);
  expect(mocks.query.mock.calls[0]?.[1]).toEqual({ employeeId, limit: 5 });
  expect(html).toContain("01.01.2026 03:30");
  expect(html).toContain('/live-monitoring?mode=history&amp;employee=employee-a&amp;liveProject=project-a');
  expect(html).toContain("Tüm geçişler");
});
