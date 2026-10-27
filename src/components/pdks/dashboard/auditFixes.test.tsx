import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PDKSImportDialog } from "./PDKSImportDialog";
import { PDKSSavedViews } from "./PDKSSavedViews";
import { PDKSFilterBar, type FilterValues } from "./PDKSFilterBar";
import { PDKSDateNavigator } from "./PDKSDateNavigator";
import { PDKSHeatmapView } from "./PDKSHeatmapView";
import { restorePdksFocus } from "../lib/focus";
import { ManualPdksEditDialog } from "../ManualPdksEditDialog";
import { pdksToday } from "../lib/calendar";

const state = vi.hoisted(() => ({ values: [] as unknown[], cursor: 0, actions: [] as { label: string; invoke: () => void }[], remove: vi.fn(), apply: vi.fn() }));
vi.mock("react", async importOriginal => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T) => {
    const index = state.cursor++;
    if (!(index in state.values)) state.values[index] = initial;
    return [state.values[index], (next: T | ((old: T) => T)) => { state.values[index] = typeof next === "function" ? (next as (old: T) => T)(state.values[index] as T) : next; }];
  } };
});
vi.mock("@/hooks/usePdksSavedViews", () => ({ usePdksSavedViews: () => ({ views: [{ id: "saved", name: "Geç kalanlar" }], save: vi.fn(), remove: state.remove, apply: state.apply }) }));
vi.mock("@/contexts/ActiveProjectContext", () => ({ useActiveProject: () => ({ projectId: "p", activeProject: { name: "Merkez" } }) }));
vi.mock("@/hooks/usePdksFilterOptions", () => ({ usePdksFilterOptions: () => ({ departments: [], companies: [], positions: [], shifts: [] }) }));
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Dialog: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null, DialogContent: Box, DialogDescription: Box, DialogFooter: Box, DialogHeader: Box, DialogTitle: Box };
});
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    AlertDialog: ({ open, children, onOpenChange }: { open: boolean; children: ReactNode; onOpenChange: (open: boolean) => void }) => {
      if (open) state.actions.push({ label: "Vazgeç", invoke: () => onOpenChange(false) });
      return open ? <div>{children}</div> : null;
    },
    AlertDialogContent: Box, AlertDialogDescription: Box, AlertDialogFooter: Box,
    AlertDialogHeader: Box, AlertDialogTitle: Box, AlertDialogCancel: Box,
  };
});
vi.mock("@/components/ui/sheet", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { Sheet: ({ open, children }: { open: boolean; children: ReactNode }) => open ? <div>{children}</div> : null, SheetContent: Box, SheetDescription: Box, SheetHeader: Box, SheetTitle: Box };
});
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return { DropdownMenu: Box, DropdownMenuContent: Box, DropdownMenuLabel: Box, DropdownMenuTrigger: Box, DropdownMenuSeparator: () => null,
    DropdownMenuItem: ({ children, onSelect, "aria-label": label }: { children: ReactNode; onSelect: () => void; "aria-label"?: string }) => {
      state.actions.push({ label: label ?? String(children), invoke: onSelect });
      return <div role="menuitem" aria-label={label}>{children}</div>;
    } };
});
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onClick, ...props }: { children: ReactNode; onClick?: () => void; "aria-label"?: string; disabled?: boolean }) => {
  if (onClick) state.actions.push({ label: props["aria-label"] ?? String(children), invoke: onClick });
  return <button {...props}>{children}</button>;
} }));
vi.mock("@/components/ui/date-picker", () => ({ DatePicker: ({ trigger }: { trigger: ReactNode }) => trigger }));
vi.mock("@/components/shared/FilterBar", () => ({ FilterBar: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn(), useAction: () => vi.fn() }));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({ useUnsavedChangesGuard: () => ({ requestClose: vi.fn() }) }));
const values: FilterValues = { reportType: "weekly", dateRange: { from: undefined, to: undefined }, statusFilter: "all", person: "" };
const render = (node: ReactNode) => { state.cursor = 0; state.actions = []; return renderToStaticMarkup(node); };
beforeEach(() => { state.values = []; state.remove.mockReset(); state.apply.mockReset(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
describe("08 UI denetim düzeltmeleri", () => {
  it("O7: menü seçimi görünümü uygular, silme önce onay ister, iptal silmez", async () => {
    const onApply = vi.fn(); state.apply.mockReturnValue(values);
    const component = <PDKSSavedViews filters={values} onApply={onApply} />;
    expect(render(component)).toContain('aria-label="Kayıtlı görünümler"');
    state.actions.find(a => a.label === "Geç kalanlar")?.invoke();
    expect(onApply).toHaveBeenCalledWith(values);
    state.actions.find(a => a.label === "Geç kalanlar görünümünü sil")?.invoke();
    expect(state.remove).not.toHaveBeenCalled();
    expect(render(component)).toContain("Görünüm silinsin mi?");
    state.actions.find(a => a.label === "Vazgeç")?.invoke(); render(component);
    expect(state.remove).not.toHaveBeenCalled();
    state.actions.find(a => a.label === "Geç kalanlar görünümünü sil")?.invoke(); render(component);
    state.remove.mockRejectedValueOnce(new Error("Görünüm silinemedi"));
    await state.actions.find(a => a.label === "Sil")?.invoke();
    expect(state.remove).toHaveBeenCalledWith("saved");
    expect(render(component)).toContain("Görünüm silinsin mi?");
    state.remove.mockResolvedValueOnce(undefined);
    await state.actions.find(a => a.label === "Sil")?.invoke();
    expect(state.remove).toHaveBeenCalledTimes(2);
    expect(render(component)).not.toContain("Görünüm silinsin mi?");
  });
  it("D5/D11: durum filtre çubuğundadır; mobil filtre düğmesi paneli açar", () => {
    const component = <PDKSFilterBar values={values} onChange={vi.fn()} />;
    const html = render(component);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-label="Durum"');
    const controls = html.match(/<button[^>]*aria-expanded="false" aria-controls="([^"]+)"[^>]*>Filtreler<\/button>/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}" class="hidden md:block"`);
    expect(html).not.toMatch(/<select(?! aria-hidden="true")/);
    state.actions.find(a => a.label === "Filtreler")?.invoke();
    expect(render(component)).toContain('aria-expanded="true"');
  });
  it("O2/D4/D6: yabancı saat diliminde İstanbul günü ve ayı; ileri dönem kilitli ve ok hedefi 36px", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-31T21:30:00Z"));
    vi.stubEnv("TZ", "America/Los_Angeles");
    expect(pdksToday().getDate()).toBe(1);
    expect(pdksToday().getMonth()).toBe(10);
    const onChange = vi.fn();
    const html = render(<PDKSDateNavigator values={{ ...values, reportType: "daily" }} onChange={onChange} />);
    expect(html).toContain("1 Kasım 2026");
    expect(html).toContain('class="h-9 w-9"');
    expect(html).toMatch(/aria-label="Sonraki dönem" disabled/);
    state.actions.find(a => a.label === "Bugün")?.invoke();
    expect(onChange.mock.calls[0]?.[0].anchorDate.getDate()).toBe(1);
  });
  it("O6: mobil puantaj kişi sütunu 120px, geniş ekranda 192px", () => {
    const html = render(<PDKSHeatmapView records={[]} loading={false} startDate="2026-10-19" endDate="2026-10-25" />);
    expect(html).toContain("[--pdks-person-width:120px]");
    expect(html).toContain("sm:[--pdks-person-width:192px]");
    expect(html).toContain("var(--pdks-person-width)");
  });
  it("D7: kontrollü panel kapanınca açan öğeye odak döner; silinmiş öğeye dönmez", () => {
    const focus = vi.fn(), preventDefault = vi.fn();
    restorePdksFocus({ preventDefault }, { isConnected: true, focus } as unknown as HTMLElement);
    expect(focus).toHaveBeenCalledOnce(); expect(preventDefault).toHaveBeenCalledOnce();
    restorePdksFocus({ preventDefault }, { isConnected: false, focus } as unknown as HTMLElement);
    expect(focus).toHaveBeenCalledOnce();
  });
});

it("D8: doğrulama alan hatalarını tekrarlamaz; yalnız sunucu hatası başarısız kayıt özeti açar", () => {
  const form = <ManualPdksEditDialog open employeeId={"e" as import("../../../../convex/_generated/dataModel").Id<"employees">} employeeName="Ada" date="2026-10-19" initialEntry="" initialExit="" onClose={vi.fn()} />;
  state.values = ["", "", "", { entry: "En az bir saat girin.", note: "Gerekçe 3–500 karakter olmalı." }, false];
  const invalid = render(form);
  expect(invalid).not.toContain("Düzeltme kaydedilemedi.");
  expect(invalid.match(/En az bir saat girin./g)).toHaveLength(1);
  state.values = ["", "", "", { server: "Bağlantı kurulamadı." }, false];
  expect(render(form)).toContain("Düzeltme kaydedilemedi.");
});

it("O4/D9: içe aktarma hedef projeyi, Türkçe başlıkları, örnek indirmeyi ve Önizle eylemini gösterir", () => {
  const html = render(<PDKSImportDialog open onOpenChange={vi.fn()} />);
  expect(html).toContain("Merkez projesine yazılır.");
  expect(html).toContain("giriş, çıkış");
  expect(html).toContain('download="pdks-ornek.csv"');
  expect(html).toContain("Önizle");
});

it("08-H2: assigned overnight manual form labels the following day", () => {
  state.values = [];
  const props = { open: true, employeeId: "e" as import("../../../../convex/_generated/dataModel").Id<"employees">, employeeName: "Ada", date: "2026-10-19", initialEntry: "22:00", initialExit: "06:00", onClose: vi.fn() };
  expect(render(<ManualPdksEditDialog {...props} isOvernightShift />)).toContain("Çıkış ertesi gün kaydedilecek.");
  state.values = [];
  expect(render(<ManualPdksEditDialog {...props} />)).not.toContain("Çıkış ertesi gün kaydedilecek.");
});
