// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Doc } from "./_generated/dataModel";
import { decryptMailSecret, encryptMailSecret, mailSecretAad } from "./lib/mailSecret";
import { describeSmtpError, normalizeSmtpConfig, requiresNewPassword } from "./lib/smtpConfig";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());

const base = { host: "smtp.gmail.com", port: 465, username: "rapor@firma.com", fromEmail: "rapor@firma.com", isActive: true };

describe("SMTP config rules", () => {
  it("normalizes a Google account and strips app-password spaces", () => {
    expect(normalizeSmtpConfig({ ...base, host: " SMTP.Gmail.com ", password: "abcd efgh ijkl mnop" }))
      .toMatchObject({ host: "smtp.gmail.com", secure: true, password: "abcdefghijklmnop", fromName: "" });
    expect(normalizeSmtpConfig({ ...base, host: "mail.firma.com", port: 587, password: "a b" })).toMatchObject({ secure: false, password: "a b" });
  });
  it.each(["127.0.0.1", "localhost", "10.0.0.5", "smtp", "smtp.gmail.com:465"])("rejects internal or malformed host %s", host => {
    expect(() => normalizeSmtpConfig({ ...base, host })).toThrow();
  });
  it("rejects port 25 and header injection in the sender name", () => {
    expect(() => normalizeSmtpConfig({ ...base, port: 25 })).toThrow();
    expect(normalizeSmtpConfig({ ...base, fromName: "Firma\r\nBcc: x@y.com <a>" }).fromName).toBe("FirmaBcc: x@y.com a");
  });
  it("requires a new password when host or username changes", () => {
    const saved = { smtpHost: "smtp.gmail.com", smtpUsername: "rapor@firma.com", smtpPassword: "v1.x.y" };
    expect(requiresNewPassword(saved, { host: "smtp.gmail.com", username: "rapor@firma.com" })).toBe(false);
    expect(requiresNewPassword(saved, { host: "evil.example.com", username: "rapor@firma.com" })).toBe(true);
    expect(requiresNewPassword(saved, { host: "smtp.gmail.com", username: "baska@firma.com" })).toBe(true);
    expect(requiresNewPassword(null, base)).toBe(true);
  });
  it("explains Google auth failures with the app-password hint", () => {
    expect(describeSmtpError({ code: "EAUTH", responseCode: 535, message: "Invalid login: 535-5.7.8 secret" }, "smtp.gmail.com"))
      .toMatch(/uygulama şifresi.*\[EAUTH 535\]/);
    expect(describeSmtpError({ code: "ETIMEDOUT" }, "mail.firma.com")).toMatch(/bağlanılamadı/);
  });
});

describe("mail secret encryption", () => {
  it("round-trips and binds ciphertext to the project", async () => {
    vi.stubEnv("MAIL_SECRET_KEY", btoa(String.fromCharCode(...new Uint8Array(32).fill(7))));
    const stored = await encryptMailSecret("abcdefghijklmnop", mailSecretAad("p1"));
    expect(stored).toMatch(/^v1\./);
    expect(stored).not.toContain("abcdefghijklmnop");
    expect(await decryptMailSecret(stored, mailSecretAad("p1"))).toBe("abcdefghijklmnop");
    await expect(decryptMailSecret(stored, mailSecretAad("p2"))).rejects.toThrow();
  });
  it("fails closed without a key", async () => {
    vi.stubEnv("MAIL_SECRET_KEY", "");
    await expect(encryptMailSecret("x", "a")).rejects.toThrow(/MAIL_SECRET_KEY/);
  });
});

async function setup(role: Doc<"users">["role"]) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const caller = await ctx.db.insert("users", { role, verified: true, email: "yonetici@firma.com" });
    const session = await ctx.db.insert("authSessions", { userId: caller, expirationTime: Date.now() + 1_000_000 });
    const project = await ctx.db.insert("projects", { name: "Proje", ownerId: caller });
    await ctx.db.insert("userProjects", { userId: caller, projectId: project });
    return { caller, session, project };
  });
  return { t, ids, caller: t.withIdentity({ subject: `${ids.caller}|${ids.session}` }) };
}
const row = { host: "smtp.gmail.com", port: 465, secure: true, username: "rapor@firma.com", fromEmail: "rapor@firma.com", fromName: "Firma", isActive: true };

describe("project mail settings", () => {
  it("stores the account without ever returning the password", async () => {
    const { t, ids, caller } = await setup("super_admin");
    await t.mutation(internal.mailSettings.upsertForCaller, { ...row, callerId: ids.caller, projectId: ids.project, passwordEnc: "v1.iv.data" });
    const saved = await caller.query(api.mailSettings.get, { projectId: ids.project });
    expect(saved).toMatchObject({ host: "smtp.gmail.com", hasPassword: true, isActive: true });
    expect(JSON.stringify(saved)).not.toContain("v1.iv.data");
    expect(await t.query(internal.mailSettings.getForDelivery, { projectId: ids.project })).toMatchObject({ passwordEnc: "v1.iv.data" });
  });
  it("keeps the stored password only while host and username stay the same", async () => {
    const { t, ids } = await setup("super_admin");
    const args = { ...row, callerId: ids.caller, projectId: ids.project };
    await expect(t.mutation(internal.mailSettings.upsertForCaller, args)).rejects.toThrow(/şifresini girin/);
    await t.mutation(internal.mailSettings.upsertForCaller, { ...args, passwordEnc: "v1.iv.data" });
    await t.mutation(internal.mailSettings.upsertForCaller, { ...args, fromName: "Yeni ad" });
    await expect(t.mutation(internal.mailSettings.upsertForCaller, { ...args, host: "evil.example.com" })).rejects.toThrow(/yeniden girin/);
  });
  it("falls back to the default provider when the account is inactive", async () => {
    const { t, ids } = await setup("super_admin");
    await t.mutation(internal.mailSettings.upsertForCaller, { ...row, isActive: false, callerId: ids.caller, projectId: ids.project, passwordEnc: "v1.iv.data" });
    expect(await t.query(internal.mailSettings.getForDelivery, { projectId: ids.project })).toBeNull();
    expect(await t.query(internal.mailSettings.getForCaller, { callerId: ids.caller, projectId: ids.project })).toMatchObject({ isActive: false });
  });
  it("rejects users without admin.manage", async () => {
    const { t, ids, caller } = await setup("project_user");
    await expect(t.mutation(internal.mailSettings.upsertForCaller, { ...row, callerId: ids.caller, projectId: ids.project, passwordEnc: "v1.iv.data" })).rejects.toThrow();
    await expect(caller.query(api.mailSettings.get, { projectId: ids.project })).rejects.toThrow();
    await expect(t.query(internal.mailSettings.getForCaller, { callerId: ids.caller, projectId: ids.project })).rejects.toThrow();
  });
});
