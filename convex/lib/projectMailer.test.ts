import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { sendViaProjectSmtp, sendViaDefaultProvider } from "./projectMailer";
import type { ProjectSmtpConfig } from "./smtpConfig";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => smtp) } }));
vi.mock("./mailSecret", () => ({ decryptMailSecret: vi.fn(async () => "smtp-password"), mailSecretAad: vi.fn(() => "project-aad") }));
const config: ProjectSmtpConfig = { host: "smtp.example.test", port: 465, secure: true, username: "sender@example.test", fromEmail: "sender@example.test", fromName: "Project", isActive: true, passwordEnc: "ciphertext" };
const base = { to: "visitor@example.test", subject: "Visit", html: "<p>PIN: 123456</p>" };
const attachments = [{ filename: "qr.png", content: Buffer.from("png-bytes"), contentType: "image/png" as const }];
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); smtp.sendMail.mockReset(); smtp.close.mockReset(); });
describe("project mail PNG attachment delivery", () => {
  it("passes PNG bytes to SMTP and keeps attachment-free mail unchanged", async () => {
    smtp.sendMail.mockResolvedValue({});
    expect(await sendViaProjectSmtp("project" as Id<"projects">, config, { ...base, attachments })).toEqual({ ok: true, channel: "smtp" });
    expect(smtp.sendMail).toHaveBeenLastCalledWith({ from: { name: "Project", address: config.fromEmail }, ...base, attachments });
    await sendViaProjectSmtp("project" as Id<"projects">, config, base);
    expect(smtp.sendMail).toHaveBeenLastCalledWith({ from: { name: "Project", address: config.fromEmail }, ...base });
    expect(smtp.close).toHaveBeenCalledTimes(2);
  });
  it("encodes PNG attachment bytes for the default provider", async () => {
    vi.stubEnv("RESEND_API_KEY", "synthetic-key");
    const fetch = vi.fn(async () => new Response(null, { status: 200 })); vi.stubGlobal("fetch", fetch);
    expect(await sendViaDefaultProvider({ ...base, attachments })).toEqual({ ok: true, channel: "resend" });
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ body: expect.stringContaining('"content":"cG5nLWJ5dGVz"') }));
    expect(fetch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ body: expect.stringContaining('"content_type":"image/png"') }));
  });
  it("keeps provider errors bounded without logging mail content", async () => {
    vi.stubEnv("RESEND_API_KEY", "synthetic-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("private provider body", { status: 500 })));
    const log = vi.spyOn(console, "error");
    expect(await sendViaDefaultProvider({ ...base, attachments })).toEqual({ ok: false, channel: "resend", error: "E-posta servisi HTTP 500 hatası verdi" });
    expect(log).not.toHaveBeenCalled();
  });
});
