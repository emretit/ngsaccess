import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RuleSaveNotice, RecentRuns, SyncRunSheet, ProjectSyncButton } from "./SyncRuns";
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({ runs: undefined as unknown[] | undefined, detail: undefined as unknown }));
vi.mock("convex/react", () => ({ useAction: () => vi.fn(), useQuery: () => state.detail ?? state.runs }));

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
  expect(html).toContain("Gönderilemedi");
  expect(html).toContain("2 atlandı");
  expect(html).not.toContain("0 kuyrukta");
  state.runs = undefined;
});

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
it("çevrimdışı cihaz için yeniden gönderim yolunu açıklar", () => {
  state.detail = { status: "partial", counts: { queued: 0, sent: 0, verified: 0, failed: 0, skipped: 1, unknown: 0 },
    targets: [{ _id: "target", deviceName: "Giriş", brand: "hikvision", status: "skipped", reason: "Cihaz çevrimdışı" }] };
  const html = renderToStaticMarkup(<SyncRunSheet runId={"run" as Id<"deviceSyncRuns">} onClose={() => undefined} />);
  expect(html).toContain("Gönderilemedi");
  expect(html).toContain("Cihaz bağlanınca yeniden gönderin.");
  expect(html).toContain("Cihaz aldığını bildirene kadar “Gönderildi” görünür.");
  expect(html).not.toContain("teslim kanıtı değildir");
  expect(html).not.toContain("Kısmi sonuç");
  state.detail = undefined;
});

vi.mock("@/components/shared/ConfirmAction", () => ({
  ConfirmAction: ({ description }: { description: ReactNode }) => <p>{description}</p>,
}));
it("proje gönderim onayını sade dille açıklar", () => {
  const html = renderToStaticMarkup(<ProjectSyncButton projectId={"p" as Id<"projects">} />);
  expect(html).toContain("Cihaz aldığını bildirene kadar “Gönderildi” görünür.");
  expect(html).not.toContain("Hikvision gönderimi teslim kanıtı");
  expect(html).not.toContain("IDE cihaz onayı");
});
