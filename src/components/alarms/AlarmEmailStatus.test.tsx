import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AlarmEmailStatus } from "./AlarmEmailStatus";

afterEach(() => vi.useRealTimers());

describe("alarm e-postası durumu", () => {
  it("shows the failed attempt, reason and only retry time in Istanbul", () => {
    const html = renderToStaticMarkup(<AlarmEmailStatus delivery={{ status: "retryScheduled", attempts: 1, error: "E-posta servisi HTTP 503 hatası verdi", at: "2026-10-22T12:00:00Z", retryAt: "2026-10-22T12:05:00Z" }} />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Başarısız; tek tekrar planlandı");
    expect(html).toContain("Deneme: 1/2");
    expect(html).toContain("HTTP 503");
    expect(html).toContain("15:05:00");
  });
  it("shows sending older than ten minutes as an error, including the final attempt", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-22T12:11:00Z"));
    for (const attempts of [1, 2]) {
      const html = renderToStaticMarkup(<AlarmEmailStatus delivery={{ status: "sending", attempts, at: "2026-10-22T12:00:00Z" }} />);
      expect(html).toContain("Gönderim yarıda kaldı"); expect(html).toContain("text-danger");
    }
    expect(renderToStaticMarkup(<AlarmEmailStatus delivery={{ status: "sending", at: "2026-10-22T12:01:00Z" }} />)).toContain("Gönderiliyor");
    expect(renderToStaticMarkup(<AlarmEmailStatus delivery={{ status: "sending", at: "invalid" }} />)).toContain("Gönderiliyor");
  });
  it("distinguishes service acceptance from a queued send and an absent record", () => {
    expect(renderToStaticMarkup(<AlarmEmailStatus delivery={{ status: "sent" }} />)).toContain("E-posta servisi kabul etti");
    expect(renderToStaticMarkup(<AlarmEmailStatus delivery={{ status: "queued", attempts: 0 }} />)).toContain("Kuyrukta");
    expect(renderToStaticMarkup(<AlarmEmailStatus delivery={null} />)).toContain("Henüz gönderim kaydı yok");
  });
});
