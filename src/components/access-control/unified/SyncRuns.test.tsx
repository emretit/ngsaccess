import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RuleSaveNotice, RecentRuns } from "./SyncRuns";
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({ runs: undefined as unknown[] | undefined }));
vi.mock("convex/react", () => ({ useAction: () => vi.fn(), useQuery: () => state.runs }));

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

it("şablon gönderimini kural gönderiminden ayırır", () => {
  state.runs = [{ _id: "run", kind: "template_sync", status: "done", startedAt: Date.parse("2026-10-22T07:00:00Z"), counts: { queued: 0, sent: 1, verified: 0, failed: 0, skipped: 0, unknown: 0 } }];
  const html = renderToStaticMarkup(<RecentRuns projectId={"p" as Id<"projects">} />);
  expect(html).toContain("Şablon gönderimi");
  expect(html).not.toContain("Kural gönderimi");
  state.runs = undefined;
});

it("yalnız son gönderimi sıfır olmayan sayılarla gösterir", () => {
  state.runs = [{ _id: "run", kind: "rule_sync", status: "partial", startedAt: Date.parse("2026-10-22T10:09:00Z"), counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 2, unknown: 0 } }];
  const html = renderToStaticMarkup(<RecentRuns projectId={"p" as Id<"projects">} />);
  expect(html).toContain("Son gönderim");
  expect(html).not.toContain("Son gönderimler");
  expect(html).toContain("Kısmi sonuç");
  expect(html).toContain("2 atlandı");
  expect(html).not.toContain("0 kuyrukta");
  state.runs = undefined;
});
