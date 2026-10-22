import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { Switch } from "@/components/ui/switch";
import { HolidaySeedConfirmation, countMissingHolidays } from "./sections/components/HolidayCalendarManager";
import { ReminderScopeConfirmation } from "./sections/reports/ReportReminderSettings";
import { ReportsSettings } from "./sections/ReportsSettings";
import { BridgeIntegrationCard } from "./sections/integrations/BridgeIntegrationCard";
import { VisitorNoticeCard, visitorNoticeSchema } from "./sections/privacy/VisitorNoticeCard";
import { overtimeHints } from "./sections/components/OvertimeSettingsForm";
import type { Id } from "../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({ query: vi.fn(), mutation: vi.fn(), role: "project_admin" }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: state.role } }) }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => state.query(...args), useMutation: () => state.mutation }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project", projectIds: ["project"], activeProject: { name: "Merkez" }, isAdmin: false, loading: false }) }));
// Render dialog content synchronously, so copy and callbacks can be checked without a browser.
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null, DialogContent: Part, DialogHeader: Part, DialogTitle: Part, DialogDescription: Part };
});
vi.mock("@/components/ui/alert-dialog", () => {
  const Part = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return { AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null, AlertDialogContent: Part, AlertDialogHeader: Part, AlertDialogTitle: Part, AlertDialogDescription: Part, AlertDialogFooter: Part, AlertDialogCancel: Part, AlertDialogAction: Part };
});

function clickText(node: React.ReactNode, label: string): boolean {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<{ children?: React.ReactNode; onClick?: () => void }>(child)) continue;
    if (child.props.children === label && child.props.onClick) { child.props.onClick(); return true; }
    if (clickText(child.props.children, label)) return true;
  }
  return false;
}

describe("13 ayarlar audit düzeltmeleri", () => {
  it("O1/D4 gives the label a 44px clickable row, right aligns switches, and retains ARIA", () => {
    const html = renderToStaticMarkup(<FormFieldWrapper inline htmlFor="flag" label="Bildirim" hint="Açıklama"><Switch checked /></FormFieldWrapper>);
    expect(html).toContain("flex min-h-11 cursor-pointer items-center justify-between gap-4");
    expect(html).toContain('for="flag"');
    expect(html).toContain('id="flag"');
    expect(html).toContain('aria-describedby="flag-hint"');
    expect(html).toContain("min-w-0 flex-1");
  });
  it.each([['sgk', 'sgk'], ['overtime', 'overtime'], ['dept-cost', 'department']])("O5 opens the linked %s report and uses units and sentence case", (requested, selected) => {
    state.query.mockReturnValue({ rows: [{ employeeId: 'a' }, { employeeId: 'b' }], scopeLabel: "Merkez" });
    const html = renderToStaticMarkup(<MemoryRouter><ReportsSettings requestedReport={requested} /></MemoryRouter>);
    expect(html).toContain(`<option value="${selected}" selected=""`);
    expect(html).toContain(selected === "department" ? "2 departman" : "2 personel");
    expect(html).toContain("Excel indir");
    expect(html).not.toContain("Excel İndir");
    expect(html).not.toContain("h-10");
  });
  it.each(["project_user", "project_admin", "super_admin"])("shows pay controls and totals only for managers (%s)", role => {
    state.role = role;
    state.query.mockReturnValue({ rows: [{ employeeId: "a" }], scopeLabel: "Merkez", totalOvertimeHours: 5, totalOvertimePayTRY: 500 });
    const department = renderToStaticMarkup(<ReportsSettings requestedReport="dept-cost" />);
    const overtime = renderToStaticMarkup(<ReportsSettings requestedReport="overtime" />);
    expect(department.includes("Ücret bilgisi olmayanlar için saatlik ücret")).toBe(role !== "project_user");
    expect(overtime.includes("Toplam mesai ücreti")).toBe(role !== "project_user");
    expect(overtime).toContain("Toplam fazla mesai: 5 saat");
    state.role = "project_admin";
  });
  it("D5 excludes existing dates and requires explicit confirmation to load", () => {
    const total = countMissingHolidays(2026, []);
    expect(total).toBeGreaterThan(10);
    expect(countMissingHolidays(2026, [{ date: "2026-01-01" }])).toBe(total - 1);
    const confirm = vi.fn();
    const dialog = HolidaySeedConfirmation({ open: true, year: 2026, count: 2, pending: false, onOpenChange: vi.fn(), onConfirm: confirm });
    expect(renderToStaticMarkup(dialog)).toContain("2026 yılı için 2 tatil eklenecek");
    expect(confirm).not.toHaveBeenCalled();
    expect(clickText(dialog, "Tatilleri yükle")).toBe(true);
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("D6 fully masks an existing Hikvision key", () => {
    state.query.mockReturnValue([{ _id: "bridge", token: "never-expose-this-secret" }]);
    const html = renderToStaticMarkup(<BridgeIntegrationCard />);
    expect(html).toContain('value="••••••••"');
    expect(html).not.toContain("never-exp");
  });
  it("D7 describes and confirms a scope change", () => {
    const confirm = vi.fn();
    const dialog = ReminderScopeConfirmation({ open: true, onOpenChange: vi.fn(), onConfirm: confirm });
    expect(renderToStaticMarkup(dialog)).toContain("Kapsamı değiştirirseniz kaydedilmemiş hatırlatma taslağı silinir");
    expect(confirm).not.toHaveBeenCalled();
    clickText(dialog, "Kapsamı değiştir");
    expect(confirm).toHaveBeenCalledOnce();
  });
  it("06-O5 rejects unsafe/incomplete URLs and loads the saved URL and version without inventing text", () => {
    expect(visitorNoticeSchema.safeParse({ visitorKvkkUrl: "javascript:alert(1)", visitorKvkkVersion: "1" }).success).toBe(false);
    expect(visitorNoticeSchema.safeParse({ visitorKvkkUrl: "https://example.com/privacy", visitorKvkkVersion: "" }).success).toBe(false);
    expect(visitorNoticeSchema.safeParse({ visitorKvkkUrl: "", visitorKvkkVersion: "" }).success).toBe(true);
    state.query.mockReturnValue({ visitorKvkkUrl: "https://example.com/notice", visitorKvkkVersion: "2026-01" });
    const html = renderToStaticMarkup(<VisitorNoticeCard projectId={"project" as Id<"projects">} />);
    expect(html).toContain('value="https://example.com/notice"');
    expect(html).toContain('value="2026-01"');
  });
  it("D10 explains the policy fields, night multiplier applies only to night overtime (13-H1)", () => {
    expect(overtimeHints.annualOvertimeLimitHours).toContain("engellemez");
    expect(overtimeHints.monthlyHoursBase).toContain("saatlik ücret");
    expect(overtimeHints.nightShiftMultiplier).toContain("fazla mesai");
  });
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ role: state.role === "super_admin" ? "super_admin" : state.role === "project_admin" ? "admin" : "viewer", can: (permission: string) => state.role !== "project_user" || permission === "reports.view", loading: false }) }));

vi.mock("./sections/reports/ReportReminderSettings", async original => ({ ...await original<typeof import("./sections/reports/ReportReminderSettings")>(), ReportReminderSettings: () => null }));
