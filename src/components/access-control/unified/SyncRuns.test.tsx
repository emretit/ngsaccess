import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RuleSaveNotice } from "./SyncRuns";
import type { Id } from "../../../../convex/_generated/dataModel";

vi.mock("convex/react", () => ({ useAction: () => vi.fn(), useQuery: () => undefined }));

describe("rule diff save feedback", () => {
  it("offers the existing full-send path when there was no device diff", () => {
    const html = renderToStaticMarkup(<RuleSaveNotice result={{ ruleId: "rule" as Id<"accessRules">, runId: null }} onDismiss={() => undefined} />);
    expect(html).toContain("Değişiklik yok");
    expect(html).toContain("Cihazlara gönder");
    expect(html).not.toContain("Gönderim sonucunu aç");
  });
  it("offers this save's run result without claiming device delivery", () => {
    const html = renderToStaticMarkup(<RuleSaveNotice result={{ ruleId: "rule" as Id<"accessRules">, runId: "run" as Id<"deviceSyncRuns"> }} onDismiss={() => undefined} />);
    expect(html).toContain("Gönderim sonucunu aç");
    expect(html).toContain("Cihaz gönderiminin sonucu ayrıca izlenir");
    expect(html).not.toContain("uygulandı");
  });
});
