import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
const state = vi.hoisted(() => ({
  run: undefined as
    | { status: "running" | "done" | "partial" | "failed" }
    | undefined,
  effect: undefined as (() => void) | undefined,
  completed: { current: false },
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useRef: () => state.completed,
  useEffect: (effect: () => void) => {
    state.effect = effect;
  },
}));
vi.mock("convex/react", () => ({ useQuery: () => state.run }));
vi.mock("../SyncRuns", () => ({ SyncRunSheet: () => null }));
import { RunNotice } from "./RunNotice";
beforeEach(() => {
  state.completed.current = false;
  state.run = undefined;
  state.effect = undefined;
});
it.each(["done", "partial", "failed"] as const)(
  "%s tamamlanınca yalnız bir otomatik yenileme yapar",
  (status) => {
    const refresh = vi.fn();
    const render = () => {
      const html = renderToStaticMarkup(
        <RunNotice
          runId={"run" as Id<"deviceSyncRuns">}
          onComplete={refresh}
        />,
      );
      state.effect?.();
      return html;
    };
    render();
    state.run = { status: "running" };
    render();
    expect(refresh).not.toHaveBeenCalled();
    state.run = { status };
    const html = render();
    render();
    render();
    expect(refresh).toHaveBeenCalledOnce();
    expect(html).toContain("Gönderim sonucunu aç");
    expect(html).toContain("Cihaz gönderiminin sonucu ayrıca izlenir");
  },
);
