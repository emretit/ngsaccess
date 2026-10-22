import { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSettingsDraft } from "./SettingsFormState";
import { generalPayload, generalSchema } from "./sections/general/generalForm";
import { SettingsSidebar } from "./SettingsSidebar";
import { SettingsSaveBar } from "./SettingsSaveBar";
import { ReportsSettings } from "./sections/ReportsSettings";
import Settings from "@/pages/Settings";
import { SETTINGS_SECTIONS } from "./SettingsSidebar";
import { holidaySchema } from "./sections/components/HolidayCalendarManager";

const mocks = vi.hoisted(() => ({ role: "project_admin", query: vi.fn(), mutation: vi.fn() }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: mocks.role } }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project-a", projectIds: ["project-a", "project-b"], activeProject: { name: "Merkez" }, isAdmin: true, loading: false }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useProjectChangeGuard: () => undefined }));
vi.mock("convex/react", () => ({ useQuery: mocks.query, useMutation: () => mocks.mutation }));
afterEach(() => { mocks.role = "project_admin"; mocks.query.mockReset(); });

function draftSequence(steps: { source: { name: string; enabled: boolean }; edit?: { name?: string; enabled?: boolean }; reset?: boolean }[]) {
  const results = new Map<number, { values: { name: string; enabled: boolean }; dirty: boolean; remoteChanged: boolean }>();
  function Harness() {
    const [step, setStep] = useState(0);
    const current = steps[step];
    const draft = useSettingsDraft(current.source);
    results.set(step, { values: draft.values, dirty: draft.dirty, remoteChanged: draft.remoteChanged });
    if (step < steps.length - 1) {
      if (current.edit) draft.change(current.edit);
      if (current.reset) draft.reset();
      setStep(step + 1);
    }
    return null;
  }
  renderToStaticMarkup(<Harness />);
  return [...results.values()];
}

describe("settings draft and payload contracts", () => {
  it("preserves draft and baseline when subscriptions change, then resets to the latest source", () => {
    const initial = { name: "Eski", enabled: false };
    const remote = { name: "Uzak", enabled: true };
    expect(draftSequence([
      { source: initial, edit: { name: "Taslak" } }, { source: initial },
      { source: remote, reset: true }, { source: remote },
    ])).toEqual([
      { values: initial, dirty: false, remoteChanged: false },
      { values: { ...initial, name: "Taslak" }, dirty: true, remoteChanged: false },
      { values: { ...initial, name: "Taslak" }, dirty: true, remoteChanged: true },
      { values: remote, dirty: false, remoteChanged: false },
    ]);
  });
  it("becomes pristine when edits are reversed, including a stored false", () => {
    const source = { name: "Şirket", enabled: false };
    const result = draftSequence([{ source, edit: { enabled: true } }, { source, edit: { enabled: false } }, { source }]);
    expect(result.map(state => state.dirty)).toEqual([false, true, false]);
    expect(result[2].values.enabled).toBe(false);
  });
  it("keeps nullable clears and omits hidden language/date/time fields", () => {
    const values = generalSchema.parse({ companyName: "  Şirket  ", taxNumber: " ", address: "", email: "", phone: "", website: "", currency: "TRY", darkMode: false, notifications: false });
    const payload = generalPayload(values);
    expect(payload).toMatchObject({ companyName: "Şirket", taxNumber: null, email: null, darkMode: false, notificationsEnabled: false });
    for (const field of ["systemLanguage", "timezone", "dateFormat", "workingHoursStart", "workingHoursEnd", "logoUrl"]) expect(payload).not.toHaveProperty(field);
    expect(generalSchema.safeParse({ ...values, companyName: "  " }).success).toBe(false);
    expect(generalSchema.safeParse({ ...values, email: "yanlış" }).success).toBe(false);
  });
  it("writes only edited fields and preserves concurrent remote changes", () => {
    const baseline = generalSchema.parse({ companyName: "Şirket", taxNumber: "", address: "Adres", email: "old@example.com", phone: "123", website: "", currency: "TRY", darkMode: true, notifications: true });
    const live = { ...generalPayload(baseline), companyName: "Uzak şirket", email: "remote@example.com" };
    const patch = generalPayload({ ...baseline, phone: "456" }, baseline);
    expect(patch).toEqual({ phone: "456" });
    expect({ ...live, ...patch }).toEqual({ ...live, phone: "456" });
    expect(generalPayload({ ...baseline, phone: "", darkMode: false, notifications: false }, baseline))
      .toEqual({ phone: null, darkMode: false, notificationsEnabled: false });
    expect(generalPayload({ ...baseline, companyName: " Şirket " }, baseline)).toEqual({});
    expect(generalPayload(baseline, baseline)).toEqual({});
  });
  it("validates actual calendar dates and trimmed holiday names", () => {
    expect(holidaySchema.safeParse({ date: "2026-02-30", name: "Tatil", isHalfDay: false }).success).toBe(false);
    expect(holidaySchema.safeParse({ date: "2026-10-29", name: "  ", isHalfDay: false }).success).toBe(false);
    expect(holidaySchema.parse({ date: "2027-10-29", name: " Tatil ", isHalfDay: true })).toEqual({ date: "2027-10-29", name: "Tatil", isHalfDay: true });
  });
});

describe("settings presentation contracts", () => {
  it("shows a labeled mobile select and desktop navigation without widening mail permission", () => {
    const render = () => renderToStaticMarkup(<MemoryRouter><SettingsSidebar selected="general" onSelect={() => undefined} /></MemoryRouter>);
    const manager = render();
    expect(manager).toContain('aria-label="Ayar bölümleri"');
    expect(manager).toContain('for="settings-section"');
    expect(manager).toContain('aria-current="page"');
    expect(manager).not.toContain("E-posta gönderimi");
    mocks.role = "super_admin";
    const admin = render();
    expect(admin).toContain("E-posta gönderimi");
    expect(admin.indexOf("Mesai ve tatil")).toBeLessThan(admin.indexOf("Raporlar"));
  });
  it("hides pristine save controls and blocks invalid/pending submissions", () => {
    expect(renderToStaticMarkup(<SettingsSaveBar dirty={false} label="Genel ayarları kaydet" onCancel={() => undefined} />)).toBe("");
    expect(renderToStaticMarkup(<SettingsSaveBar dirty valid={false} label="Genel ayarları kaydet" onCancel={() => undefined} />)).toMatch(/type="submit"[^>]*disabled/);
    expect(renderToStaticMarkup(<SettingsSaveBar dirty saving label="Genel ayarları kaydet" onCancel={() => undefined} />)).toContain("Kaydediliyor…");
  });
  it("loads the stored reminder type independently from the report download and keeps false", () => {
    mocks.query.mockImplementation((reference, args) => {
      if (args === "skip") return undefined;
      if (getFunctionName(reference) === "reports:getReportSchedule") return { reportType: "overtime", email: "a@example.com", enabled: false };
      return { rows: [], scopeLabel: "Merkez", reliabilityNote: "Doğrulanmış kapsam" };
    });
    const html = renderToStaticMarkup(<ReportsSettings />);
    expect(html).toMatch(/id="report-type"[\s\S]*?<option value="sgk" selected=""/);
    expect(html).toMatch(/id="reminder-type"[\s\S]*?<option value="overtime" selected=""/);
    expect(html).toContain("Kayıtlı durum: Kapalı");
    expect(html).toContain("Dosya eki gönderilmez");
    expect(html).not.toContain("Kaydedilmemiş değişiklikler");
  });
});


describe("settings page permission boundary", () => {
  it("does not mount any settings query for a member or a manager requesting mail", () => {
    for (const role of ["project_user", "project_admin"]) {
      mocks.role = role;
      const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/settings?tab=mail"]}><Settings /></MemoryRouter>);
      expect(html).toContain("Bu ayar bölümünü görüntüleme yetkiniz yok");
      expect(html).not.toContain("Ayar bölümleri");
      expect(mocks.query).not.toHaveBeenCalled();
    }
  });
  it("renders an invalid tab as general with one page heading and preserves the no-record state", () => {
    mocks.query.mockReturnValue(null);
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/settings?tab=unknown"]}><Settings /></MemoryRouter>);
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html.split(SETTINGS_SECTIONS[0].scope)).toHaveLength(2);
    expect(html).toContain("Henüz şirket bilgisi kaydedilmemiş");
    expect(html).not.toContain("Genel ayarları kaydet");
  });
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ role: mocks.role === "super_admin" ? "super_admin" : mocks.role === "project_admin" ? "admin" : "viewer", can: (permission: string) => mocks.role !== "project_user" || permission === "reports.view", loading: false }) }));
