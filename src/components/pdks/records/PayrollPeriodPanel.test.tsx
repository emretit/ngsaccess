import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { MonthlyPayrollView } from "./MonthlyPayrollView";

const state = vi.hoisted(() => ({ role: "super_admin" }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ role: state.role }) }));
vi.mock("convex/react", () => ({
  useQuery: () => ({ status: "closed", snapshotReady: false, snapshotError: "Bordro sabitleme tamamlanamadı. Kapanışı tekrar deneyin veya süper admin dönemi yeniden açsın." }),
  useMutation: () => vi.fn(),
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
}));

it("shows failed closure as an error and keeps super_admin recovery enabled instead of spinning forever", () => {
  state.role = "super_admin";
  const html = renderToStaticMarkup(<MonthlyPayrollView projectId={"project" as Id<"projects">} period="2026-06" onCellClick={() => undefined} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain("tamamlanamadı");
  const reopenAttributes = html.match(/<button([^>]*)>Yeniden aç<\/button>/)?.[1];
  expect(reopenAttributes).toBeDefined();
  expect(reopenAttributes).not.toMatch(/\sdisabled(?:=|\s|$)/);
  expect(html).toContain("Kapanışı tekrar dene");
  expect(html).not.toContain("animate-spin");
});
it("lets the project admin retry a failed close while only super_admin can reopen it", () => {
  state.role = "admin";
  const html = renderToStaticMarkup(<MonthlyPayrollView projectId={"project" as Id<"projects">} period="2026-06" onCellClick={() => undefined} />);
  expect(html).toContain("Kapanışı tekrar dene");
  expect(html).not.toContain(">Yeniden aç</button>");
});
