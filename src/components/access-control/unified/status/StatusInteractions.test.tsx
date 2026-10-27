import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { useStatusFilters } from "./StatusPage";
import { RedistributeBar, RedistributeDialog } from "./RedistributeControls";
import { EmployeeGrantSheet } from "./EmployeeGrantSheet";
import { StatusFilters } from "./StatusFilters";
import { GrantRows } from "./StatusViews";
import { useRedistribution } from "./useRedistribution";
import type { GrantRow } from "./model";

const runner = vi.hoisted(() => ({
  states: [] as unknown[], cursor: 0, mutate: vi.fn(),
  clear: undefined as (() => void) | undefined,
  focus: undefined as ((event: { preventDefault: () => void }) => void) | undefined,
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => {
  const index = runner.cursor++;
  if (!(index in runner.states)) runner.states[index] = typeof initial === "function" ? initial() : initial;
  return [runner.states[index], (next: unknown) => { runner.states[index] = typeof next === "function" ? next(runner.states[index]) : next; }];
} }));
vi.mock("convex/react", () => ({ useMutation: () => runner.mutate }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Dialog: Part, DialogContent: Part, DialogHeader: Part, DialogTitle: Part, DialogDescription: Part };
});
vi.mock("@/components/ui/sheet", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Sheet: Part, SheetHeader: Part, SheetTitle: Part, SheetDescription: Part,
    SheetContent: ({ children, onCloseAutoFocus }: { children: ReactNode; onCloseAutoFocus: typeof runner.focus }) => {
      runner.focus = onCloseAutoFocus; return <div>{children}</div>;
    } };
});
vi.mock("@/components/shared/FilterBar", () => ({
  FilterBar: ({ children, search, onClear, hasFilters }: { children?: ReactNode; search?: string; onClear?: () => void; hasFilters?: boolean }) => {
    if (onClear) runner.clear = onClear;
    return <div data-active={hasFilters}><input value={search ?? ""} readOnly />{children}</div>;
  },
}));
const projectId = "project" as Id<"projects">;
const row: GrantRow = {
  _id: "grant" as Id<"accessGrantStatus">, _creationTime: 0, projectId,
  employeeId: "employee" as Id<"employees">, deviceId: "device" as Id<"devices">,
  employeeName: "Deniz Yılmaz", departmentName: null, deviceName: "Ana giriş", state: "effective", updatedAt: 0,
  ruleIds: [], templateIds: [], ruleNames: [], templateNames: [], doorIds: [], doorNames: [],
  stale: false, doorUnresolved: false, brand: "hikvision",
};
const counts = { all: 7, effective: 7, pending: 0, failed: 0, removed: 0, unknown: 0, capped: false, personCount: 7 };
function render(element: ReactNode) { runner.cursor = 0; return renderToStaticMarkup(element); }
function filters() {
  let current: ReturnType<typeof useStatusFilters> | undefined;
  function Harness() { current = useStatusFilters(); return null; }
  render(<Harness />);
  if (!current) throw new Error("Filtreler kurulamadı");
  return current;
}
beforeEach(() => { runner.states = []; runner.cursor = 0; vi.clearAllMocks(); });
describe("Yetki Durumu etkileşimleri", () => {
  it("tek temizle işlemi bütün filtreleri ve aramayı sıfırlar", () => {
    const initial = filters();
    initial.change({ departmentId: "dep" as Id<"departments">, deviceId: row.deviceId, ruleId: "r" as Id<"accessRules">, templateId: "t" as Id<"accessScheduleTemplates">, state: "failed", search: "Deniz" });
    initial.setSearch("Deniz");
    const active = filters();
    render(<StatusFilters {...active} options={{ departments: [], devices: [], rules: [], templates: [] }} />);
    runner.clear?.();
    expect(filters().filters).toEqual({});
    expect(filters().search).toBe("");
  });
  it("kapsamdaki cihaz filtre ve arama değişiminde açık kalır; başka cihaz seçimi kapatır", () => {
    filters().setExpanded(row.deviceId);
    filters().change({ state: "pending", departmentId: "dep" as Id<"departments"> });
    filters().setSearch("Deniz");
    expect(filters().expanded).toBe(row.deviceId);
    filters().change({ deviceId: row.deviceId });
    expect(filters().expanded).toBe(row.deviceId);
    filters().clear();
    expect(filters().expanded).toBe(row.deviceId);
    filters().change({ deviceId: "other" as Id<"devices"> });
    expect(filters().expanded).toBeUndefined();
  });
  it("onay ilk beş kişi ve cihazı, kalan kayıt sayısını ve projeyi gösterir", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({ ...row, employeeId: `e${index}` as Id<"employees">, employeeName: `Kişi ${index}`, deviceName: `Cihaz ${index}` }));
    const html = render(<RedistributeDialog action="selected" selected={rows} selectedRows={rows} projectName="NGS Projesi" sending={false} send={async () => {}} setAction={() => {}} projectCounts={counts} error="" setError={() => {}} />);
    for (const name of ["NGS Projesi", "Kişi 0", "Cihaz 0", "Kişi 4", "Cihaz 4", "ve 2 kayıt daha", "Seçili 7 kaydı yeniden gönder"]) expect(html).toContain(name);
    expect(html).not.toContain("Kişi 5");
    expect(html).not.toContain("kişi×cihaz");
  });
  it("cihaz yönetim yetkisi yoksa tümünü gönder düğmesi sunulmaz", () => {
    const props = { selected: [row], sending: false, projectCounts: counts, setError: vi.fn(), setAction: vi.fn() };
    expect(render(<RedistributeBar {...props} canManageDevices={false} />)).not.toContain("Tümünü yeniden dağıt");
    expect(render(<RedistributeBar {...props} canManageDevices />)).toContain("Tümünü yeniden dağıt");
  });
  it("yetki kaybedilirse açık tümünü gönder onayı mutation başlatamaz; seçili gönderim korunur", async () => {
    let current: ReturnType<typeof useRedistribution> | undefined;
    function Harness() { current = useRedistribution({ projectId, selected: [row], setSelected: vi.fn(), setError: vi.fn(), canManageDevices: false }); return null; }
    render(<Harness />); current?.setAction("all"); render(<Harness />); await current?.send();
    expect(runner.mutate).not.toHaveBeenCalled();
    current?.setAction("selected"); render(<Harness />); await current?.send();
    expect(runner.mutate).toHaveBeenCalledWith({ projectId, pairs: [row] });
  });
  it("çekmece kapanışında açan öğeye odak döndürür", () => {
    const focus = vi.fn(); const preventDefault = vi.fn();
    const trigger = { isConnected: true, focus } as unknown as HTMLElement;
    render(<EmployeeGrantSheet employee={row} setEmployee={() => {}} detail={null} detailError="" returnFocusRef={{ current: trigger }} />);
    runner.focus?.({ preventDefault });
    expect(focus).toHaveBeenCalledOnce(); expect(preventDefault).toHaveBeenCalledOnce();
  });
  it("mobil seçim gerçek label ile en az 44px alan sunar; filtreler sayıyla açılır", () => {
    const html = render(<GrantRows rows={[row]} selected={[]} onToggle={() => {}} onEmployee={() => {}} canManage />);
    expect(html).toMatch(/<label[^>]*for="mobile-employee:device"[^>]*class="[^"]*min-h-11/);
    expect(html).toContain('id="mobile-employee:device"');
    const filterHtml = render(<StatusFilters filters={{ state: "failed", deviceId: row.deviceId, search: "Deniz" }} search="Deniz" setSearch={() => {}} change={() => {}} clear={() => {}} options={{ departments: [], devices: [], rules: [], templates: [] }} />);
    expect(filterHtml).toContain("Filtreler (2)");
    expect(filterHtml).toContain('aria-expanded="false"');
  });
});
