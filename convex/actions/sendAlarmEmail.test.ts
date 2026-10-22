import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { send } from "./sendAlarmEmail";

vi.mock("../_generated/api", () => ({ internal: { alarms: { claimEmail: "claimEmail", recordEmailResult: "recordEmailResult" } } }));
const sendHandler = (send as unknown as { _handler: (ctx: ActionCtx, args: { eventId: Id<"deviceEvents">; attempt?: number }) => Promise<null> })._handler;
const originalFetch = globalThis.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
function payload() {
  return { event: { severity: "critical", label: "<img src=x onerror='alert(1)'>", eventTime: "2026-10-19T10:00:00.000Z" }, device: { name: "A&B <Kapı>" }, recipients: ["one@example.com", "two@example.com"] };
}
function context(value: ReturnType<typeof payload> | null = payload()) {
  const runMutation = vi.fn().mockResolvedValueOnce(value).mockResolvedValue(null);
  return { ctx: { runMutation } as unknown as ActionCtx, runMutation };
}
const args = { eventId: "e1" as Id<"deviceEvents"> };
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  vi.restoreAllMocks();
});

describe("sendAlarmEmail.send", () => {
  it("escapes html, continues after network errors and records only failed recipients", async () => {
    process.env.RESEND_API_KEY = "test-key";
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error("private address must not be saved")).mockResolvedValueOnce(new Response(null, { status: 200 }));
    globalThis.fetch = fetchMock;
    const { ctx, runMutation } = context();
    await sendHandler(ctx, args);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as { html: string; to: string[] };
    expect(body.to).toEqual(["two@example.com"]);
    expect(body.html).toContain("A&amp;B &lt;Kapı&gt;");
    expect(body.html).toContain("&lt;img src=x onerror=&#039;alert(1)&#039;&gt;");
    expect(runMutation).toHaveBeenLastCalledWith("recordEmailResult", { ...args, attempt: 1, failedRecipients: ["one@example.com"], error: "E-posta servisine ulaşılamadı" });
  });
  it("records missing configuration without calling Resend", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn(); globalThis.fetch = fetchMock;
    const { ctx, runMutation } = context();
    await sendHandler(ctx, args);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runMutation).toHaveBeenLastCalledWith("recordEmailResult", expect.objectContaining({ failedRecipients: payload().recipients, error: "E-posta servisi yapılandırılmamış" }));
  });
  it("records HTTP failures without response bodies or recipient logs", async () => {
    process.env.RESEND_API_KEY = "test-key";
    globalThis.fetch = vi.fn().mockResolvedValueOnce(new Response("private", { status: 500 })).mockResolvedValueOnce(new Response(null, { status: 200 }));
    const log = vi.spyOn(console, "error");
    const { ctx, runMutation } = context();
    await sendHandler(ctx, { ...args, attempt: 2 });
    expect(runMutation).toHaveBeenLastCalledWith("recordEmailResult", { ...args, attempt: 2, failedRecipients: ["one@example.com"], error: "E-posta servisi HTTP 500 hatası verdi" });
    expect(log).not.toHaveBeenCalled();
  });
  it("does nothing when the atomic claim rejects a duplicate or cancelled send", async () => {
    const fetchMock = vi.fn(); globalThis.fetch = fetchMock;
    const { ctx, runMutation } = context(null);
    await sendHandler(ctx, args);
    expect(fetchMock).not.toHaveBeenCalled(); expect(runMutation).toHaveBeenCalledTimes(1);
  });
});
