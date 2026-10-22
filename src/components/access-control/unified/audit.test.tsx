vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({ type: "visitor", detailType: "personnel", doorless: false, queries: [] as { name: string; args: unknown }[] }));
vi.mock("convex/react", () => ({
  useConvex: () => ({}), useAction: () => vi.fn(),
  useQuery: (ref: FunctionReference<"query">, args: unknown) => {
    const name = getFunctionName(ref);
    state.queries.push({ name, args });
    if (name === "accessRules:listSummaries") return { page: [{ _id: "r", name: "NGS", targetType: "visitor", memberCount: 0, panels: [{ deviceId: "p", label: "Panel — tüm kapılar" }], unassignedDoors: [] }], isDone: true, continueCursor: "" };
    if (name === "accessRules:projectDeviceCounts") return { total: 4, brands: { hikvision: 2, ide_smart: 1, other: 1 } };
    if (name === "accessRules:getDetails") return { targetType: state.detailType, panels: [{ deviceId: "p", label: "Panel X — 1/4 kapı", doors: [{ doorId: "d", name: "Giriş", zoneName: "Kat 1" }] }], unassignedDoors: [] };
    return [];
  },
  usePaginatedQuery: () => ({ results: [], status: "Exhausted", loadMore: vi.fn() }),
}));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [new URLSearchParams({ tur: state.type }), vi.fn()] }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "project", activeProject: { name: "Proje" }, canManage: true }) }));
vi.mock("@/hooks/access-rules/useAccessRuleMutations", () => ({ useAccessRuleMutations: () => ({ updateAccessRule: {}, deleteAccessRule: {} }) }));
vi.mock("@/components/sync/DeviceSyncStatusBanner", () => ({ DeviceSyncStatusBanner: () => null }));
vi.mock("@/hooks/useDevices", () => ({ useDevices: () => ({ devices: [{ _id: "p", name: "Panel", brand: "hikvision" }] }) }));
vi.mock("@/hooks/useZonesAndDoors", () => ({ useZonesAndDoors: () => ({ zones: [{ _id: "z", name: "Bölge" }], doors: state.doorless ? [] : [{ _id: "d", name: "Kapı", deviceId: "p", zoneId: "z" }] }) }));
vi.mock("@/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [{ _id: "e", firstName: "Ali", lastName: "Yılmaz" }] }) }));
vi.mock("@/hooks/useDepartments", () => ({ useDepartments: () => ({ departments: [] }) }));
import AccessRulesList from "./AccessRulesList";
import { AccessRuleDetails } from "./AccessRuleDetails";
import { ProjectSyncButton, brandDistribution } from "./SyncRuns";
import { DepartmentTree } from "./components/DepartmentTree";
import { ZoneDeviceTree } from "./components/ZoneDeviceTree";

const projectId = "project" as Id<"projects">;
describe("05 denetim düzeltmeleri", () => {
  it("kapsamı bir kez yazar, türü sunucuya yollar ve A2 filtrelerini sunar", () => {
    state.queries.length = 0;
    const html = renderToStaticMarkup(<AccessRulesList onCreateRule={() => undefined} />);
    expect(html).not.toContain("tüm kapılar · tüm kapılar");
    expect(html).toContain("Panel — tüm kapılar");
    expect(state.queries).toContainEqual({ name: "accessRules:listSummaries", args: expect.objectContaining({ type: "visitor" }) });
    expect(html.match(/<select aria-hidden="true"/g)).toHaveLength(3);
    expect(html.match(/role="combobox"/g)).toHaveLength(3);
    expect(html).toContain("min-h-11");
    expect(html).toContain("max-md:[&amp;_button]:min-h-11");
    expect(html).not.toContain("Tür filtresi bu cursor");
  });
  it("proje gönderimi yalnız sunucu sayımını ister ve kapsamı dürüst belirtir", () => {
    state.queries.length = 0;
    const html = renderToStaticMarkup(<ProjectSyncButton projectId={projectId} />);
    expect(html).toContain("Tüm proje cihazlarına gönder");
    expect(state.queries.map(q => q.name)).toEqual(["accessRules:projectDeviceCounts"]);
    expect(brandDistribution({ hikvision: 2, ide_smart: 1, other: 1, legacy: 1 })).toBe("Hikvision: 2, IDE Smart: 1, Diğer: 2");
  });
  it("personelde ziyaretçi notu göstermez, kapıyı panel altında bir kez gösterir", () => {
    state.detailType = "personnel";
    const html = renderToStaticMarkup(<AccessRuleDetails ruleId={"r" as Id<"accessRules">} projectId={projectId} />);
    expect(html).not.toContain("Ziyaretçiler ekranından");
    expect(html).toContain("Panel X — 1/4 kapı");
    expect(html.match(/Giriş/g)).toHaveLength(1);
    expect(html.indexOf("Panel X")).toBeLessThan(html.indexOf("Giriş"));
    expect(html).not.toContain("Açık kapı seçimleri");
    state.detailType = "visitor";
    expect(renderToStaticMarkup(<AccessRuleDetails ruleId={"r" as Id<"accessRules">} projectId={projectId} />)).toContain("Ziyaretçiler ekranından");
  });
  it("kişi ve kapı etiketlerini geniş tıklama alanına bağlar", () => {
    const formData = { selected_devices: [], selected_doors: [], selected_employees: [] };
    for (const tree of [<ZoneDeviceTree formData={formData} setFormData={() => undefined} />, <DepartmentTree formData={formData} setFormData={() => undefined} />]) {
      const html = renderToStaticMarkup(tree);
      expect(html).toContain("flex flex-1 min-h-11 items-center cursor-pointer");
      expect(html).toMatch(/<label[^>]*for="[^"]+"/);
    }
  });
  it("disableDoorless açıkken kapısız cihazı ve bölgeyi seçime kapatır; varsayılan davranışı korur", () => {
    state.doorless = true;
    const formData = { selected_devices: [], selected_doors: [] };
    const render = (disabled: boolean) => renderToStaticMarkup(<ZoneDeviceTree formData={formData} setFormData={() => undefined} disableDoorless={disabled} />);
    const disabled = render(true);
    expect(disabled).toContain("Kapı yok");
    expect(disabled.match(/role="checkbox"[^>]*disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
    const enabled = render(false);
    expect(enabled).not.toContain("Kapı yok");
    expect(enabled).toContain("tüm cihaz");
    expect(enabled).not.toMatch(/role="checkbox"[^>]*disabled=""/);
    state.doorless = false;
  });

});
