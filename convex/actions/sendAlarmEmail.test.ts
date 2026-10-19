import { afterEach, describe, expect, it, vi } from "vitest";
import { send } from "./sendAlarmEmail";

vi.mock("../_generated/api", () => ({ internal: { alarms: { emailPayload: "emailPayload" } } }));
const sendHandler = (send as unknown as { _handler: (ctx: { runQuery: () => Promise<unknown> }, args: { eventId: string }) => Promise<null> })._handler;
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;

function payload() {
  return { event: { severity: "critical", label: "<img src=x onerror='alert(1)'>", eventTime: "2026-10-19T10:00:00.000Z" }, device: { name: "A&B <Kapı>" }, recipients: ["one@example.com", "two@example.com"], minSeverity: "warning", sentRecently: false };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  vi.restoreAllMocks();
});

describe("sendAlarmEmail.send", () => {
  it("escapes html and continues to the next recipient after a fetch error", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;
    await sendHandler({ runQuery: async () => payload() }, { eventId: "e1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { html: string; to: string[] };
    expect(body.to).toEqual(["two@example.com"]);
    expect(body.html).toContain("A&amp;B &lt;Kapı&gt;");
    expect(body.html).toContain("&lt;img src=x onerror=&#039;alert(1)&#039;&gt;");
  });

  it("does not call Resend without an API key", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;
    await sendHandler({ runQuery: async () => payload() }, { eventId: "e1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs a non-success response and attempts remaining recipients", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await sendHandler({ runQuery: async () => payload() }, { eventId: "e1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalled();
  });
});
