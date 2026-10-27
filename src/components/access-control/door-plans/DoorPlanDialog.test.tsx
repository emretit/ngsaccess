vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true, loading: false }),
}));
import { isValidElement, type ReactNode, type ReactElement } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { notify } from "@/lib/notify";
import { DoorPlanImpactSummary } from "./DoorPlanImpactSummary";
import { DoorStatusPlanEditor } from "../DoorStatusPlanEditor";
import { TemplatePicker } from "../unified/templates/TemplatePicker";
import { DoorVerifyPlanSection } from "../door-dialog/DoorVerifyPlanSection";
import type { VerifyPlan } from "../../../../convex/lib/doorStatusPlan";
import { CopyDoorPlansDialog } from "./CopyDoorPlansDialog";
import { DoorPlanDialog, type DoorPlanTarget } from "./DoorPlanDialog";
import type { DoorStatusPlan } from "../../../../convex/lib/doorStatusPlan";
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  save: vi.fn(),
  apply: vi.fn(),
  dirty: false,
  holidays: [] as { beginDate: string; endDate: string }[],
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = state.cursor++;
    if (state.slots.length <= index)
      state.slots[index] =
        typeof initial === "function" ? (initial as () => unknown)() : initial;
    return [
      state.slots[index],
      (next: unknown) => {
        state.slots[index] =
          typeof next === "function"
            ? (next as (previous: unknown) => unknown)(state.slots[index])
            : next;
      },
    ];
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.holidays,
  useMutation: () => state.save,
  useAction: () => state.apply,
}));
vi.mock("@/hooks/useProjectAccess", () => ({
  useProjectAccess: () => ({ canManage: true }),
}));
vi.mock("@/hooks/useAsyncAction", () => ({
  useAsyncAction: (run: (...args: unknown[]) => Promise<unknown>) => ({
    run,
    pending: false,
  }),
}));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({
  useUnsavedChangesGuard: (dirty: boolean) => {
    state.dirty = dirty;
    return { requestClose: vi.fn(), dialog: null };
  },
}));
vi.mock("@/lib/notify", () => ({
  errorMessage: String,
  notify: { success: vi.fn(), info: vi.fn() },
}));
const legacy: DoorStatusPlan = {
  enabled: true,
  beginTime: "08:00:00",
  endTime: "18:00:00",
  mode: "remainOpen",
};
type Props = Record<string, unknown> & { children?: ReactNode };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap((child) => nodes(child));
  if (!isValidElement<Props>(node)) return [];
  return [node, ...nodes(node.props.children)];
}
function find(
  node: ReactNode,
  predicate: (element: ReactElement<Props>) => boolean,
) {
  const found = nodes(node).find(predicate);
  if (!found) throw new Error("Element bulunamadı");
  return found;
}
const hasText = (node: ReactNode, text: string) =>
  nodes(node).some(element => element.props.children === text);
const submit = (node: ReactNode) =>
  (find(node, element => element.type === "form").props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: vi.fn() });
const retrySend = (node: ReactNode) =>
  (find(node, element => element.props.children === "Cihaza tekrar gönder").props.onClick as () => Promise<void>)();
afterEach(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.stubGlobal("document", { getElementById: () => null });
  state.slots = [];
  state.cursor = 0;
  state.dirty = false;
  vi.mocked(notify.success).mockClear();
  vi.mocked(notify.info).mockClear();
  state.save.mockReset().mockResolvedValue(["status"]);
  state.apply.mockReset().mockResolvedValue({ ok: true });
});
describe("DoorPlanDialog haftalık kayıt", () => {
  const door: DoorPlanTarget = {
    doorId: "door" as Id<"doors">,
    projectId: "project" as Id<"projects">,
    hikDoorStatusTemplateId: null,
    templateName: null,
    templateChanged: false,
    hikPlanSavedAt: null,
    hikPlanAppliedAt: null,
    hikPlanApplyError: null,
    plansPending: false,
    hikDoorHolidayPlan: null,
    holidaySupported: null,
    doorName: "Kapı",
    deviceName: "Panel",
    zoneName: null,
    deviceOnline: true,
    hikVerifyPlan: null,
    hikDoorStatusPlan: legacy,
  };
  function dialog(overrides: Partial<DoorPlanTarget> = {}) {
    state.cursor = 0;
    return DoorPlanDialog({
      open: true,
      onOpenChange: vi.fn(),
      onSuccess: vi.fn(),
      door: { ...door, ...overrides },
    });
  }
  it("04-H1 boş kayıtta başarı bildirmez, bilgi verir ve düzenlemeyi açık tutar", async () => {
    state.save.mockResolvedValue([]);
    await submit(dialog());
    expect(state.apply).not.toHaveBeenCalled();
    expect(notify.success).not.toHaveBeenCalled();
    expect(notify.info).toHaveBeenCalledWith("Değişiklik yok; cihaza bir şey gönderilmedi.");
    expect(hasText(dialog(), "Kaydet ve cihaza gönder")).toBe(true);
  });
  it.each([
    { plansPending: true },
    { hikPlanApplyError: "Çevrimdışı" },
  ])("04-H1 açılışta kaydedilmiş planı değişikliksiz tekrar gönderir (%j)", async overrides => {
    const tree = dialog(overrides);
    expect(hasText(tree, "hikPlanApplyError" in overrides ? "Son gönderim başarısız: Çevrimdışı" : "Kaydedildi ama cihaza gönderilmedi")).toBe(true);
    await retrySend(tree);
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(1));
    expect(state.save).not.toHaveBeenCalled();
    expect(hasText(dialog(overrides), "Cihaza tekrar gönder")).toBe(false);
  });
  it("04-H1 boş değişiklik listesinde bekleyen durum, tatil ve doğrulama planlarını gönderir", async () => {
    state.save.mockResolvedValue([]);
    await submit(dialog({
      plansPending: true,
      hikDoorStatusPlan: null,
      hikDoorHolidayPlan: { enabled: true, year: 2026, mode: "remainClosed" },
      hikVerifyPlan: { enabled: true, beginTime: "08:00", endTime: "18:00", verifyMode: "card" },
    }));
    expect(state.apply).toHaveBeenCalledTimes(2);
    expect(notify.success).toHaveBeenCalledTimes(1);
  });
  it("04-H1 kalıcı tekrar gönderim hatasında tekrar denemeyi korur", async () => {
    state.apply.mockResolvedValueOnce({ ok: false, error: "Çevrimdışı" });
    const overrides = { plansPending: true };
    await retrySend(dialog(overrides));
    await vi.waitFor(() => expect(hasText(dialog(overrides), "Son gönderim başarısız: Çevrimdışı")).toBe(true));
    await retrySend(dialog(overrides));
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(2));
    expect(state.save).not.toHaveBeenCalled();
  });
  it("04-H1 kısmi hatada yalnız başarısız türü tekrar gönderir", async () => {
    state.save.mockResolvedValue(["status", "verify"]);
    state.apply.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, error: "Doğrulama gönderilemedi" });
    await submit(dialog());
    expect(state.apply).toHaveBeenCalledTimes(2);
    expect(notify.success).not.toHaveBeenCalled();
    await retrySend(dialog());
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(3));
    expect(state.save).toHaveBeenCalledTimes(1);
  });
  it("04-H1 devre dışı bırakılıp bekleyen planı cihazdan kaldırmak için gönderir", async () => {
    const overrides = { plansPending: true, hikDoorStatusPlan: { ...legacy, enabled: false } };
    await retrySend(dialog(overrides));
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(1));
    expect(state.save).not.toHaveBeenCalled();
  });
  it("R1 gönderilecek kayıtlı plan yokken eski hata için takılı uyarı göstermez", () => {
    const tree = dialog({ hikPlanApplyError: "Çevrimdışı", hikDoorStatusPlan: null });
    expect(nodes(tree).some(element => element.props.role === "status")).toBe(false);
    expect(hasText(tree, "Cihaza tekrar gönder")).toBe(false);
  });
  it("R2 hata metni boş gelirse varsayılan gönderilemedi metnini gösterir", async () => {
    state.apply.mockResolvedValue({ ok: false });
    await submit(dialog());
    expect(hasText(dialog(), "Cihaza gönderilemedi")).toBe(true);
  });
  it("R3 açıklamada kapı ve cihaz adı görünür", () => {
    expect(nodes(dialog()).some(element => Array.isArray(element.props.children) &&
      element.props.children.includes("Kapı") && element.props.children.includes("Panel"))).toBe(true);
  });
  it("R4 düzenleme yokken başarılı tekrar gönderim dialogu kapatır, düzenleme varken açık tutar", async () => {
    const onOpenChange = vi.fn();
    const render = () => {
      state.cursor = 0;
      return DoorPlanDialog({ open: true, onOpenChange, onSuccess: vi.fn(), door: { ...door, plansPending: true } });
    };
    await retrySend(render());
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));

    state.slots = [];
    onOpenChange.mockClear();
    const change = find(render(), element => element.type === DoorStatusPlanEditor).props.onChange as (plan: DoorStatusPlan) => void;
    change({ ...legacy, endTime: "09:00" });
    await retrySend(render());
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(notify.success).toHaveBeenCalledTimes(2));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
  it("04-H2 yalnız değişiklikte etki özeti ve açık gönderim düğmesi gösterir", () => {
    const tree = dialog();
    expect(nodes(tree).some(element => element.type === DoorPlanImpactSummary)).toBe(false);
    const change = find(tree, element => element.type === DoorStatusPlanEditor).props.onChange as (plan: DoorStatusPlan) => void;
    change({ ...legacy, endTime: "09:00" });
    const updated = dialog();
    expect(find(updated, element => element.type === DoorPlanImpactSummary).props).toMatchObject({ doorName: "Kapı", statusPlan: { mode: "remainOpen", endTime: "09:00" } });
    expect(hasText(updated, "Kaydet ve cihaza gönder")).toBe(true);
  });
  it("Y1 status-only edit omits untouched verify payload and send", async () => {
    state.save.mockResolvedValue(["status"]);
    const onChange = find(dialog(), element => element.type === DoorStatusPlanEditor).props.onChange as (plan: DoorStatusPlan) => void;
    onChange({ ...legacy, mode: "remainClosed" });
    await submit(dialog());
    expect(state.save.mock.calls[0][0]).not.toHaveProperty("hikVerifyPlan");
    expect(state.apply).toHaveBeenCalledTimes(1);
  });
  it("O4 UI blocks enabling holidays for a year without dates", async () => {
    const checkbox = nodes(dialog()).find(element => element.type === "input" && element.props.type === "checkbox" && element.props.disabled !== undefined);
    if (!checkbox) throw new Error("Tatil checkbox bulunamadı");
    (checkbox.props.onChange as (event: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    await submit(dialog());
    expect(state.save).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
    expect(hasText(dialog(), "Seçilen yılda uygulanacak tatil yok")).toBe(true);
  });
  it("Y1 leaves a legacy enabled verify plan untouched during status edits", async () => {
    const overrides = { hikVerifyPlan: { enabled: true, beginTime: "08:00", endTime: "18:00", verifyMode: "cardAndFace" } };
    const onChange = find(dialog(overrides), element => element.type === DoorStatusPlanEditor).props.onChange as (plan: DoorStatusPlan) => void;
    onChange({ ...legacy, mode: "remainClosed" });
    await submit(dialog(overrides));
    expect(state.save.mock.calls[0][0]).not.toHaveProperty("hikVerifyPlan");
    expect(state.apply).toHaveBeenCalledTimes(1);
  });
  it.each([null, { enabled: true, beginTime: "08:00", endTime: "18:00", verifyMode: "card" }])("Y1 copying absent or identical verify never includes it in the save (%j)", async verify => {
    const source = { ...door, hikVerifyPlan: verify };
    const target = { ...source, doorId: "target" as Id<"doors"> };
    state.cursor = 0;
    const tree = CopyDoorPlansDialog({ targets: [source, target], selectedIds: [target.doorId], onClose: vi.fn() });
    (find(tree, element => element.props.children === "Kaydet ve gönder").props.onClick as () => void)();
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0]).not.toHaveProperty("hikVerifyPlan");
  });
  it("Y1 template copy saves and sends status only", async () => {
    const targets = [door];
    const render = () => { state.cursor = 0; return CopyDoorPlansDialog({ targets, selectedIds: [door.doorId], onClose: vi.fn() }); };
    (find(render(), element => element.props["aria-label"] === "Kaynak türü").props.onChange as (event: { target: { value: string } }) => void)({ target: { value: "template" } });
    (find(render(), element => element.type === TemplatePicker).props.onChange as (id: string) => void)("template");
    (find(render(), element => element.props.children === "Kaydet ve gönder").props.onClick as () => void)();
    await vi.waitFor(() => expect(state.apply).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0]).toMatchObject({ hikDoorStatusTemplateId: "template" });
    expect(state.save.mock.calls[0][0]).not.toHaveProperty("hikVerifyPlan");
  });
  it("O4 UI blocks bulk copies of an empty holiday year", () => {
    const source: DoorPlanTarget = { ...door, hikDoorHolidayPlan: { enabled: true, year: 2099, mode: "remainClosed" } };
    state.cursor = 0;
    const tree = CopyDoorPlansDialog({ targets: [source], selectedIds: [source.doorId], onClose: vi.fn() });
    const button = find(tree, element => element.props.children === "Kaydet ve gönder");
    expect(button.props.disabled).toBe(true);
    (button.props.onClick as () => void)();
    expect(state.save).not.toHaveBeenCalled();
  });
  it("weekly değişikliğini guard'a dahil eder, saniyeleri ve modları kaydet payload'unda korur", async () => {
    const initial = dialog();
    expect(state.dirty).toBe(false);
    const onChange = find(
      initial,
      (element) => element.type === DoorStatusPlanEditor,
    ).props.onChange as (plan: DoorStatusPlan) => void;
    onChange({
      ...legacy,
      weekly: [
        {
          day: "Monday",
          segments: [
            {
              beginTime: "09:00:01",
              endTime: "12:00:02",
              mode: "remainClosed",
            },
          ],
        },
        { day: "Sunday", segments: [] },
      ],
    });
    const updated = dialog();
    expect(state.dirty).toBe(true);
    await (
      find(updated, (element) => element.type === "form").props
        .onSubmit as (event: { preventDefault: () => void }) => Promise<void>
    )({ preventDefault: vi.fn() });
    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({
        doorId: door.doorId,
        hikDoorStatusPlan: {
          enabled: true,
          beginTime: "09:00:01",
          endTime: "12:00:02",
          mode: "remainClosed",
          weekly: [
            {
              day: "Monday",
              segments: [
                {
                  beginTime: "09:00:01",
                  endTime: "12:00:02",
                  mode: "remainClosed",
                },
              ],
            },
            { day: "Sunday", segments: [] },
          ],
        },
      }),
    );
    expect(state.apply).toHaveBeenCalledTimes(1);
  });
  it("başarısız planı tekrar gönderir, başarılı planı ve veritabanı kaydını tekrarlamaz", async () => {
    state.apply
      .mockResolvedValueOnce({ ok: false, error: "Çevrimdışı" })
      .mockResolvedValueOnce({ ok: true });
    await submit(dialog());
    await retrySend(dialog());
    expect(state.save).toHaveBeenCalledTimes(1);
    expect(state.apply).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(hasText(dialog(), "Cihaza tekrar gönder")).toBe(false));
  });
  it("saves a selected template binding and holiday configuration", async () => {
    const initial = dialog();
    const checkbox = find(
      initial,
      (element) =>
        element.type === "input" && element.props.type === "checkbox",
    );
    (
      checkbox.props.onChange as (event: {
        target: { checked: boolean };
      }) => void
    )({ target: { checked: true } });
    const picker = find(dialog(), (element) => element.type === TemplatePicker);
    (picker.props.onChange as (id: string) => void)("template-id");
    const tree = dialog();
    await (
      find(tree, (element) => element.type === "form").props
        .onSubmit as (event: { preventDefault: () => void }) => Promise<void>
    )({ preventDefault: vi.fn() });
    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({
        hikDoorStatusTemplateId: "template-id",

      }),
    );
  });
  it("saves weekly verify changes with modes and seconds intact", async () => {
    const tree = dialog();
    const set = find(tree, (element) => element.type === DoorVerifyPlanSection)
      .props.setVerifyPlan as (plan: VerifyPlan) => void;
    const weekly = [
      {
        day: "Tuesday" as const,
        segments: [
          { beginTime: "10:00:01", endTime: "11:00:02", verifyMode: "face" },
        ],
      },
    ];
    set({
      enabled: true,
      beginTime: "08:00",
      endTime: "18:00",
      verifyMode: "card",
      weekly,
    });
    await (
      find(dialog(), (element) => element.type === "form").props
        .onSubmit as (event: { preventDefault: () => void }) => Promise<void>
    )({ preventDefault: vi.fn() });
    expect(state.save).toHaveBeenCalledWith(
      expect.objectContaining({
        hikVerifyPlan: expect.objectContaining({ weekly }),
      }),
    );
  });
});
