import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import jsQR from "jsqr";
import { createHash } from "node:crypto";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { OutgoingMail } from "../lib/projectMailer";
import { send } from "./visitorPassMail";

const mailer = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock("../lib/projectMailer", () => ({ deliverProjectMail: mailer.deliver }));
vi.mock("../_generated/api", () => ({ internal: {
  visitorPassMailData: { projectForVisitor: "project", prepare: "prepare", recordSent: "audit" }, mailSettings: { getForDelivery: "smtp" },
} }));
const handler = (send as unknown as { _handler: (ctx: ActionCtx, args: { visitorId: Id<"employees">; token: string; pin: string }) => Promise<unknown> })._handler;
const args = { visitorId: "visitor1" as Id<"employees">, token: "NGSV1.abcdefghijklmnopqrstuv", pin: "123456" };
const prepared = { ok: true, projectId: "project1", passId: "pass1", email: "ada@example.test", name: "Ada <Visitor>", startsAt: "2026-11-25T08:00:00Z", expiresAt: "2026-11-25T18:00:00Z", doors: ["Entry & Exit"] };
function context(result: unknown = prepared, configured = true) {
  const runQuery = vi.fn(async (name: string) => name === "project" ? "project1" : name === "prepare" ? result : configured ? { host: "smtp.example.test" } : null);
  const runMutation = vi.fn(async () => null);
  return { ctx: { runQuery, runMutation } as unknown as ActionCtx, runQuery, runMutation };
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); mailer.deliver.mockReset(); });

describe("visitor pass email action", () => {
  it("attaches a decodable QR PNG, includes PIN/name/validity/doors, and audits only successful delivery", async () => {
    const { ctx, runQuery, runMutation } = context();
    mailer.deliver.mockResolvedValue({ ok: true, channel: "smtp" });
    expect(await handler(ctx, args)).toEqual({ ok: true });
    const mail = mailer.deliver.mock.calls[0]?.[2] as OutgoingMail;
    expect(mail.to).toBe(prepared.email);
    expect(mail.html).toContain(args.pin); expect(mail.html).toContain("Ada &lt;Visitor&gt;");
    expect(mail.html).toContain("Entry &amp; Exit"); expect(mail.html).toContain("25.11.2026");
    expect(mail.html).not.toContain(args.token); expect(mail.html).not.toMatch(/https?:|href=|<a\b/);
    const png = mail.attachments?.[0];
    expect(png).toMatchObject({ filename: "ziyaretci-qr.png", contentType: "image/png" });
    if (!png) throw new Error("Missing attachment");
    expect(png.content.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    const decoded = await sharp(png.content).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(jsQR(new Uint8ClampedArray(decoded.data), decoded.info.width, decoded.info.height)?.data).toBe(args.token);
    expect(runQuery).toHaveBeenCalledWith("prepare", { visitorId: args.visitorId,
      tokenHash: createHash("sha256").update(args.token).digest("hex"), pinHash: createHash("sha256").update(`project1:${args.pin}`).digest("hex") });
    expect(runMutation).toHaveBeenCalledExactlyOnceWith("audit", { visitorId: args.visitorId, passId: "pass1" });
    expect(JSON.stringify({ queries: runQuery.mock.calls, audit: runMutation.mock.calls })).not.toContain(args.token);
    expect(JSON.stringify({ queries: runQuery.mock.calls, audit: runMutation.mock.calls })).not.toContain(args.pin);
  });
  it.each(["NO_EMAIL", "PASS_MISMATCH"])("does not send or audit on %s", async reason => {
    const { ctx, runMutation } = context({ ok: false, reason });
    expect(await handler(ctx, args)).toEqual({ ok: false, reason });
    expect(mailer.deliver).not.toHaveBeenCalled(); expect(runMutation).not.toHaveBeenCalled();
  });
  it("returns MAIL_NOT_CONFIGURED before generating or sending mail", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { ctx, runMutation } = context(prepared, false);
    expect(await handler(ctx, args)).toEqual({ ok: false, reason: "MAIL_NOT_CONFIGURED" });
    expect(mailer.deliver).not.toHaveBeenCalled(); expect(runMutation).not.toHaveBeenCalled();
  });
  it.each(["provider", "exception"])("returns SEND_FAILED without credentials in logs on %s failure", async kind => {
    const { ctx, runMutation } = context();
    const log = vi.spyOn(console, "error");
    if (kind === "exception") mailer.deliver.mockRejectedValue(new Error(`${args.token}:${args.pin}`));
    else mailer.deliver.mockResolvedValue({ ok: false, error: "rejected" });
    expect(await handler(ctx, args)).toEqual({ ok: false, reason: "SEND_FAILED" });
    expect(log).not.toHaveBeenCalled(); expect(runMutation).not.toHaveBeenCalled();
  });
  it("authenticates even malformed credentials and rejects arbitrary content", async () => {
    const { ctx, runQuery } = context();
    expect(await handler(ctx, { ...args, token: "arbitrary content" })).toEqual({ ok: false, reason: "PASS_MISMATCH" });
    expect(runQuery).toHaveBeenCalledExactlyOnceWith("project", { visitorId: args.visitorId });
    expect(mailer.deliver).not.toHaveBeenCalled();
  });
});
