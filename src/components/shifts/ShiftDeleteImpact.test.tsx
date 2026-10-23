import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Shift } from "./lib/planning";
import { DeleteImpact } from "./ShiftDeleteImpact";
const state = vi.hoisted(() => ({ query: vi.fn(), cursor: 0 }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => state.query(getFunctionName(ref), args) }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Box, DialogContent: Box, DialogHeader: Box, DialogTitle: Box, DialogDescription: Box };
});
const shift = { _id: "shift", name: "Gündüz" } as Shift;
const shiftId = shift._id;
it("opening delete impact requests only that definition and enables deleting an empty one", () => {
  state.cursor = 0;
  state.query.mockReturnValue({ assignmentCount: 0, employeeCount: 0, skippedAssignments: 0, truncated: false, countLabel: "Toplam" });
  const html = renderToStaticMarkup(<DeleteImpact shift={shift} onClose={() => undefined} />);
  expect(state.query).toHaveBeenCalledExactlyOnceWith("shifts:assignmentDeleteImpact", { shiftId });
  expect(html).toContain("Toplam 0 atama serisi");
  expect(html).toMatch(/<button(?![^>]* disabled=)[^>]*>Vardiyayı sil<\/button>/);
});
