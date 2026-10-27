import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
const state = vi.hoisted(() => ({
  run: undefined as
    | { status: "running" | "done" | "partial" | "failed"; counts: { sent: number; verified: number } }
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
          summary="100 kayıt gönderime alındı. Kalan 1+ hatalı kayıt sonraki turda."
        />,
      );
      state.effect?.();
      return html;
    };
    render();
    state.run = { status: "running", counts: { sent: 0, verified: 0 } };
    render();
    expect(refresh).not.toHaveBeenCalled();
    state.run = { status, counts: { sent: 0, verified: 0 } };
    const html = render();
    render();
    render();
    expect(refresh).toHaveBeenCalledOnce();
    if (status === "partial") {
      expect(html).toContain("Gönderilemedi");
      expect(html).not.toContain("Kısmi sonuç");
    }
    expect(html).toContain("Gönderim sonucunu aç");
    expect(html).not.toContain("Gönderim başlatıldı");
    expect(html).toContain("100 kayıt gönderime alındı. Kalan 1+ hatalı kayıt sonraki turda.");
    expect(html.match(/role="status"/g)).toHaveLength(1);
  },
);
