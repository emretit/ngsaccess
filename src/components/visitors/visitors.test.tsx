import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Visitor, VisitorDetail } from "@/types/visitor";
import type { VisitorFormData } from "./hooks/useVisitorFormData";
import { visitorFormPayload } from "./lib/formPayload";
import { visitorFormSchema } from "./hooks/useVisitorFormSchema";
import VisitorTable from "./VisitorTable";
import { VisitorStats } from "./VisitorStats";

const query = vi.hoisted(() => vi.fn());
vi.mock("convex/react", () => ({ useQuery: query }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project" }) }));
const row: Visitor = {
  _id: "visitor" as Id<"employees">, firstName: "İpek", lastName: "Yıldız", company: "Gizli Şirket",
  cardNumber: "•••• 1234", hostName: "Ev Sahibi", presetRuleName: "Lobi", visitStart: null,
  visitEnd: "2020-01-01T15:00:00Z", status: "checkedOut", lastSeenAt: "2020-01-01T10:00:00Z", lastDirection: "entry", presence: "inside", hasKvkkConsent: false,
};
const detail: VisitorDetail = {
  ...row, projectId: "project" as Id<"projects">, cardNumber: "IADE:old", cardReleased: true, isActive: false,
  hostEmployeeId: null, presetRuleId: "rule" as Id<"accessRules">, email: "", tcNo: null, visitorPhone: null, visitorCompany: null,
  visitPurpose: null, notes: null, kvkkConsent: null, recentReadings: [], sensitiveMasked: false,
};
const form: VisitorFormData = {
  firstName: "İpek", lastName: "Yıldız", visitorPhone: "", visitorCompany: "", visitPurpose: "", hostEmployeeId: null,
  cardNumber: "", presetRuleId: detail.presetRuleId, accessExpiresAt: "2020-01-01T18:00", isActive: false, notes: "", kvkkConsent: false,
};
afterEach(() => { vi.useRealTimers(); query.mockReset(); });

describe("visitor form boundary contracts", () => {
  it("omits unchanged historic expiry and preserves nullable clears on personal edits", () => {
    const payload = visitorFormPayload({ ...form, notes: "  düzeltme  " }, detail);
    expect(payload.kind).toBe("update");
    expect(payload.args).not.toHaveProperty("accessExpiresAt");
    expect(payload.args).not.toHaveProperty("presetRuleId");
    expect(payload.args).toMatchObject({ notes: "düzeltme", visitorPhone: null, visitorCompany: null, hostEmployeeId: null });
    expect(payload.args).not.toHaveProperty("cardNumber", "IADE:old");
  });
  it("submits exactly the notice version approved in the form", () => {
    const payload = visitorFormPayload({ ...form, kvkkConsent: true, kvkkDocumentVersion: "2026-1" }, detail);
    expect(payload.args).toMatchObject({ kvkkConsent: true, kvkkDocumentVersion: "2026-1" });
  });
  it("rejects reactivation with past expiry or a returned card", () => {
    expect(() => visitorFormPayload({ ...form, isActive: true, cardNumber: "1234" }, detail)).toThrow();
    expect(() => visitorFormPayload({ ...form, isActive: true, accessExpiresAt: "2099-01-01T18:00" }, detail)).toThrow();
  });
  it("uses Turkish wall time for validation and submission independent of browser timezone", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2030-01-01T12:00:00Z"));
    const input = { ...form, isActive: true, cardNumber: "1234", accessExpiresAt: "2030-01-01T15:30" };
    const payload = visitorFormPayload(input);
    expect(payload.args.accessExpiresAt).toBe("2030-01-01T12:30:00.000Z");
    expect(() => visitorFormPayload({ ...input, accessExpiresAt: "2030-01-01T14:59" })).toThrow();
    expect(() => visitorFormPayload({ ...input, accessExpiresAt: "2030-02-30T15:30" })).toThrow();
  });
  it("permits a personal edit to a legacy record without an expiry or region", () => {
    expect(visitorFormSchema.safeParse({ ...form, isEditing: true, originalExpiry: "", wasActive: false, accessExpiresAt: "", presetRuleId: null }).success).toBe(true);
  });
});

describe("visitor list data minimization and summary", () => {
  it("keeps checked out access separate from inside presence, omits company/card, and opens detail by button", () => {
    const html = renderToStaticMarkup(<VisitorTable visitors={[row]} onOpen={() => undefined} />);
    expect(html).toContain("Sonlandırıldı / pasif");
    expect(html).toContain("İçeride");
    expect(html).not.toContain("Süresi doldu");
    expect(html).not.toContain("Gizli Şirket");
    expect(html).not.toContain("1234");
    expect(html).toContain("İpek Yıldız işlemleri");
    expect(html).toMatch(/<button[^>]*>İpek Yıldız<\/button>/);
  });
  it("shows a summary skeleton while unresolved, never transient zeros", () => {
    query.mockReturnValue(undefined);
    const html = renderToStaticMarkup(<VisitorStats now={1} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(">0</dd>");
  });
  it("shows exactly the four filter states with full project counts", () => {
    query.mockReturnValue({ total: 604, counts: { active: 501, expired: 100, checkedOut: 2, preRegistered: 1 }, nextExpiry: null });
    const html = renderToStaticMarkup(<VisitorStats now={1} />);
    for (const label of ["Aktif", "Süresi doldu", "Sonlandırıldı / pasif", "Ön kayıt"]) expect(html).toContain(label);
    expect(html).not.toContain("Erişimi kapalı");
    expect(html).not.toContain("İçeride");
  });
});
