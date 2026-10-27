import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup as renderMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { visitorExpiryDelay } from "./hooks/useVisitorClock";
import { canCaptureVisitorCard, visitorReaderLabel } from "./lib/readerCapability";
import { DEFAULT_WORKDAYS } from "@/components/access-control/unified/components/weekdays";
import { TimeSchedule } from "@/components/access-control/unified/components/TimeSchedule";
import VisitorFormFields from "./VisitorFormFields";
import { VisitorCombobox } from "./VisitorCombobox";
import VisitorTable from "./VisitorTable";
import { VisitorList } from "./VisitorManagement";
import { VisitorFilters } from "./VisitorFilters";
import { VisitorDetailView } from "./VisitorSlideOverPanel";
import type { VisitorDetail } from "@/types/visitor";
import type { VisitorFormData } from "./hooks/useVisitorFormData";
import type { Id } from "../../../convex/_generated/dataModel";
import { getFunctionName, type FunctionReference } from "convex/server";

const notice = vi.hoisted(() => ({ value: { url: null, version: null } as { url: string | null; version: string | null } }));
const pageData = vi.hoisted(() => ({ value: { page: [] as VisitorDetail[], isDone: true, continueCursor: "done" } }));
const permissions = vi.hoisted(() => ({ manage: true }));
const mutationNames = vi.hoisted(() => [] as string[]);
vi.mock("@/hooks/useVisitors", () => ({ useVisitors: () => ({ page: pageData.value }) }));
vi.mock("convex/react", () => ({ useQuery: () => notice.value, useMutation: (ref: FunctionReference<"mutation">) => { mutationNames.push(getFunctionName(ref)); return vi.fn(); } }));
vi.mock("./VisitorCardCapture", () => ({ default: () => <div>Kart okuyucusu</div> }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => permissions.manage }) }));
const renderToStaticMarkup = (children: ReactNode) => renderMarkup(<MemoryRouter>{children}</MemoryRouter>);
const noop = () => undefined;
const form: VisitorFormData = {
  firstName: "", lastName: "", visitorPhone: "", visitorCompany: "", visitPurpose: "", hostEmployeeId: null,
  cardNumber: "", presetRuleId: null, accessExpiresAt: "2030-01-01T12:00", isActive: true, notes: "", kvkkConsent: false,
  projectId: "project" as Id<"projects">,
};
const detail: VisitorDetail = {
  _id: "visitor" as Id<"employees">, firstName: "Ada", lastName: "Test", company: null, cardNumber: "1234", hostName: null,
  presetRuleName: null, visitStart: null, visitEnd: null, status: "checkedOut", lastSeenAt: null, lastDirection: null,
  presence: "unknown", hasKvkkConsent: false, projectId: "project" as Id<"projects">, tcNo: null, sensitiveMasked: false,
  cardReleased: false, isActive: false, hostEmployeeId: null, presetRuleId: null, email: "ziyaretci-123@ngsaccess.local",
  visitorPhone: null, visitorCompany: null, visitPurpose: null, notes: null, kvkkConsent: null, recentReadings: [],
};

describe("visitor audit fixes", () => {
  it("K-06: uses the visitor deletion endpoint for the security role's delete action", () => {
    mutationNames.length = 0;
    renderToStaticMarkup(<VisitorDetailView now={0} detail={detail} canManage onEdit={noop} onDeleted={noop} />);
    expect(mutationNames).toContain("visitors:removeVisitor");
    expect(mutationNames).not.toContain("employees:remove");
  });
  it("schedules no idle polling, one wakeup at the nearest expiry, and caps distant timers", () => {
    expect(visitorExpiryDelay(null, 1000)).toBeNull();
    expect(visitorExpiryDelay(1500, 1000)).toBe(501);
    expect(visitorExpiryDelay(500, 1000)).toBe(0);
    expect(visitorExpiryDelay(10 ** 13, 0)).toBe(2147483647);
  });
  it("hides pagination and duplicate creation actions for an empty project", () => {
    const html = renderToStaticMarkup(<VisitorList search="" status="all" pageSize={25} onPageSizeChange={noop} now={0} onOpen={noop} onClear={noop} />);
    expect(html).toContain("Henüz ziyaretçi kaydı yok");
    expect(html).not.toContain("Sonraki"); expect(html).not.toContain("tarandı");
    expect(html).not.toContain("Ziyaretçi kaydet");
  });
  it("retains the shared high-contrast selected weekday style in the visitor zone schedule", () => {
    const html = renderToStaticMarkup(<TimeSchedule formData={{ start_time: "", end_time: "", days: DEFAULT_WORKDAYS }} setFormData={noop} />);
    expect(html).toContain('data-state="on"'); expect(html).toContain('data-state="off"');
    expect(html).toContain("data-[state=on]:bg-primary");
    expect(html).toContain("data-[state=on]:text-primary-foreground");
  });
  it("shows both filter labels visibly and describes project-wide matching", () => {
    const html = renderToStaticMarkup(<VisitorFilters searchQuery="" onSearchChange={noop} statusFilter="all" onStatusFilterChange={noop} onClear={noop} />);
    expect(html).toMatch(/<label[^>]*>Ziyaretçi ara<\/label>/);
    expect(html).toMatch(/<label[^>]*>Erişim durumu<\/label>/);
    expect(html).not.toContain("yalnız alınan sayfaya");
  });
  it("offers only card-capable devices and includes brand and type labels", () => {
    for (const device of [{ deviceType: "QR Kod Okuyucu" }, { deviceType: "Diğer" }, { brand: "hikvision", deviceType: "Yüz Tanıma" }, { deviceType: "Kart Okuyucu", isActive: false }, { brand: "ide_smart", deviceType: "QR Kod Okuyucu" }]) expect(canCaptureVisitorCard(device)).toBe(false);
    for (const device of [{ deviceType: "Kart Okuyucu" }, { deviceType: "RFID Okuyucu" }, { deviceType: "card-reader" }, { brand: "ide_smart" }, { brand: "hikvision", deviceType: "access_control" }]) expect(canCaptureVisitorCard(device)).toBe(true);
    expect(visitorReaderLabel({ name: "Giriş", brand: "ide_smart", deviceType: "Erişim Paneli" })).toBe("Giriş · IDE Smart · Erişim Paneli");
  });
  it("puts required access fields first and groups names; additional fields use the shared collapsible", () => {
    const html = renderToStaticMarkup(<VisitorFormFields formData={form} setFormData={noop} presetRules={[]} hostEmployees={[]} isEditing={false} onNewZone={noop} />);
    for (const id of ["v_zone", "v_expires", "v_card"]) expect(html.indexOf(`id="${id}"`)).toBeLessThan(html.indexOf('id="v_first_name"'));
    expect(html).toContain("min-[761px]:grid-cols-2");
    expect(html).not.toContain("<details");
    expect(html).toContain('aria-expanded="false"');
  });
  it("displays the configured notice and version, with a clear fallback when unconfigured", () => {
    const render = () => renderToStaticMarkup(<VisitorFormFields formData={form} setFormData={noop} presetRules={[]} hostEmployees={[]} isEditing={false} onNewZone={noop} />);
    notice.value = { url: null, version: null };
    expect(render()).toContain("Aydınlatma metni tanımlı değil.");
    expect(render().match(/<button[^>]*id="v_kvkk"[^>]*>/)?.[0]).toMatch(/\sdisabled[\s=>]/);
    expect(render()).toContain("Ziyaretçi aydınlatma metnini onayladıysa işaretleyin.");
    const settingsLink = render().match(/<a[^>]*href="\/settings\?tab=privacy"[^>]*>/)?.[0];
    expect(settingsLink).toContain('target="_blank"');
    expect(settingsLink).toContain('rel="noopener noreferrer"');
    expect(render()).not.toContain("Mevcut kayıt sistemine");
    permissions.manage = false;
    expect(render()).not.toContain('href="/settings?tab=privacy"');
    permissions.manage = true;
    notice.value = { url: "https://example.org/kvkk", version: "2026-1" };
    const html = render();
    expect(html).toContain('href="https://example.org/kvkk"');
    expect(html).toContain("Sürüm 2026-1");
    notice.value = { url: null, version: null };
  });
  it("marks invalid region and card controls visibly and semantically", () => {
    const html = renderToStaticMarkup(<VisitorFormFields formData={form} setFormData={noop} presetRules={[]} hostEmployees={[]} isEditing={false} onNewZone={noop} errors={{ presetRuleId: "Bölge seçin", cardNumber: "Kart girin" }} />);
    expect(html).toContain("border-destructive");
    expect(html).toMatch(/id="v_card"[^>]*aria-invalid="true"/);
    expect(html).toContain('aria-describedby="v_card-error"');
    expect(renderToStaticMarkup(<VisitorCombobox id="invalid" label="Bölge" options={[]} value={null} onChange={noop} error="Gerekli" />)).toMatch(/role="combobox"[^>]*class="[^"]*aria-invalid:border-destructive[^"]*"[^>]*aria-invalid="true"/);
  });
  it("uses consistent missing values and conceals synthetic contact emails", () => {
    const table = renderToStaticMarkup(<VisitorTable visitors={[detail]} onOpen={noop} />);
    expect(table).not.toContain("Seçilmedi"); expect(table).toContain("—");
    const html = renderToStaticMarkup(<VisitorDetailView now={0} detail={detail} canManage={false} onEdit={noop} onDeleted={noop} />);
    expect(html).not.toContain("ngsaccess.local"); expect(html).toContain("—");
    expect(html).not.toContain("Kaydedilmedi");
  });
});

it("hides redacted visitor reading fields without breaking the detail or list", () => {
  const redacted = { ...detail, presence: null, lastSeenAt: null, lastDirection: null, recentReadings: [] };
  const html = renderToStaticMarkup(<VisitorDetailView detail={redacted} now={Date.now()} canManage={false} onEdit={noop} onDeleted={noop} />);
  expect(html).not.toContain("Son okumalar");
  expect(html).not.toContain("Son okumaya göre konum");
  expect(html).toContain("KVKK rıza kaydı");
  const list = renderToStaticMarkup(<VisitorTable visitors={[redacted]} onOpen={noop} />);
  expect(list).toContain(redacted.firstName);
  expect(list).toContain("—");
});

it.each([false, true])("keeps access controls for new/inactive records, hides them only for active edits (%s)", isCurrentlyActive => {
  const html = renderToStaticMarkup(<VisitorFormFields formData={form} setFormData={noop} presetRules={[]} hostEmployees={[]} isEditing isCurrentlyActive={isCurrentlyActive} onNewZone={noop} />);
  expect(html.includes('id="v_active"')).toBe(!isCurrentlyActive);
  expect(html.includes("Erişimi kapatmak için ayrıntıdaki")).toBe(isCurrentlyActive);
  const newHtml = renderToStaticMarkup(<VisitorFormFields formData={form} setFormData={noop} presetRules={[]} hostEmployees={[]} isEditing={false} onNewZone={noop} />);
  expect(newHtml).toContain('id="v_active"');
});
