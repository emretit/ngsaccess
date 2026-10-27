vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true, loading: false }),
}));
import { isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DoorStatusPlanEditor } from "./DoorStatusPlanEditor";
import { EditDoorDialog } from "./EditDoorDialog";
import type { DoorStatusPlan } from "../../../convex/lib/doorStatusPlan";
import type { Id } from "../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  save: vi.fn(),
  apply: vi.fn(),
  dirty: false,
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
  notify: { success: vi.fn() },
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
function edit(initial = legacy) {
  let value = initial;
  const onChange = (next: DoorStatusPlan) => {
    value = next;
  };
  const editor = {
    tree: () => {
      state.cursor = 0;
      return DoorStatusPlanEditor({ value, onChange });
    },
    value: () => value,
    layout: (next: string) =>
      (
        find(
          editor.tree(),
          (node) => node.props["aria-label"] === "Kapı durum planı düzeni",
        ).props.onChange as (event: { target: { value: string } }) => void
      )({ target: { value: next } }),
  };
  return editor;
}
beforeEach(() => {
  state.slots = [];
  state.cursor = 0;
  state.dirty = false;
  state.save.mockReset().mockResolvedValue(undefined);
  state.apply.mockReset().mockResolvedValue({ ok: true });
});
afterEach(() => vi.unstubAllGlobals());
describe("DoorStatusPlanEditor", () => {
  it("04-O2 modları sürekli açık ve sürekli kilitli olarak adlandırır", () => {
    const html = renderToStaticMarkup(edit().tree());
    expect(html).toContain("Sürekli açık");
    expect(html).toContain("Sürekli kilitli");
    expect(html).not.toContain("Sürekli Kapalı");
    expect(html).not.toContain("Sürekli Açık");
  });
  it("Gün bazına geçiş yalnız hafta içini doldurur, hafta sonu normal kalır", () => {
    const editor = edit();
    editor.layout("weekly");
    expect(editor.value().weekly).toHaveLength(7);
    expect(
      editor
        .value()
        .weekly?.slice(0, 5)
        .every((day) => day.segments[0]?.beginTime === "08:00:00"),
    ).toBe(true);
    expect(
      editor
        .value()
        .weekly?.slice(5)
        .every((day) => day.segments.length === 0),
    ).toBe(true);
    editor.layout("daily");
    expect(editor.value().weekly).toBeUndefined();
    expect(editor.value().beginTime).toBe("08:00:00");
  });
  it("Hafta içi Pazartesiyi temel alır; farklı günler onaysız silinmez", () => {
    const editor = edit({
      ...legacy,
      weekly: [
        { day: "Monday", segments: [legacy] },
        { day: "Saturday", segments: [{ ...legacy, mode: "remainClosed" }] },
      ],
    });
    const confirm = vi.fn().mockReturnValue(false);
    vi.stubGlobal("confirm", confirm);
    editor.layout("weekdays");
    expect(
      editor.value().weekly?.find((day) => day.day === "Saturday")?.segments,
    ).toHaveLength(1);
    confirm.mockReturnValue(true);
    editor.layout("weekdays");
    expect(
      editor
        .value()
        .weekly?.slice(0, 5)
        .every((day) => day.segments[0]?.beginTime === legacy.beginTime),
    ).toBe(true);
    expect(
      editor
        .value()
        .weekly?.slice(5)
        .every((day) => day.segments.length === 0),
    ).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);
  });
  it("Günlere göre düzenlerken günler hafta içine denk gelse de paneller çökmez", () => {
    const second = { ...legacy, beginTime: "19:00:00", endTime: "20:00:00" };
    const editor = edit({
      ...legacy,
      weekly: [
        { day: "Monday", segments: [legacy] },
        { day: "Tuesday", segments: [legacy, second] },
        { day: "Wednesday", segments: [legacy] },
        { day: "Thursday", segments: [legacy] },
        { day: "Friday", segments: [legacy] },
      ],
    });
    (
      find(
        editor.tree(),
        (node) => node.props["aria-label"] === "Salı 2. aralığı sil",
      ).props.onClick as () => void
    )();
    const html = renderToStaticMarkup(editor.tree());
    expect(html).toContain("Salı ·");
    expect(html).not.toContain("Hafta içi ·");
  });
  it("Pazartesi boşken Her gün'e geçmez, satır içi uyarı gösterir", () => {
    const editor = edit({
      ...legacy,
      weekly: [{ day: "Saturday", segments: [legacy] }],
    });
    const before = editor.value();
    editor.layout("daily");
    expect(editor.value()).toBe(before);
    const html = renderToStaticMarkup(editor.tree());
    expect(html).toContain('role="alert"');
    expect(html).toContain("Önce Pazartesiye en az bir aralık ekleyin.");
  });
  it("saniyeli kayıtları korur, dakika kayıtlarında saniye alanını gizler", () => {
    const html = renderToStaticMarkup(
      edit({ ...legacy, beginTime: "08:00:01" }).tree(),
    );
    expect(html).toContain('step="1" value="08:00:01"');
    expect(html).toContain('step="60" value="18:00"');
    expect(html.match(/TR saati/g)).toHaveLength(1);
  });
});
describe("EditDoorDialog (Cihazlar)", () => {
  const door = {
    _id: "door" as Id<"doors">,
    name: "Kapı",
    hikDoorNo: 2,
    hikDoorStatusPlan: legacy,
  };
  function dialog() {
    state.cursor = 0;
    return EditDoorDialog({
      open: true,
      onOpenChange: vi.fn(),
      onSuccess: vi.fn(),
      door,
      device: {
        _id: "device" as Id<"devices">,
        brand: "hikvision",
        hikTransport: "gateway",
      },
    });
  }
  it("kapı durum/doğrulama planlarını göstermez, kaydederken planlara dokunmaz", async () => {
    const initial = dialog();
    expect(() =>
      find(initial, (element) => element.type === DoorStatusPlanEditor),
    ).toThrow();
    expect(state.dirty).toBe(false);
    await (
      find(initial, (element) => element.type === "form").props
        .onSubmit as (event: { preventDefault: () => void }) => Promise<void>
    )({ preventDefault: vi.fn() });
    expect(state.save).toHaveBeenCalledWith({
      doorId: door._id,
      name: "Kapı",
      doorCode: undefined,
      hikDoorNo: 2,
    });
    expect(state.apply).not.toHaveBeenCalled();
  });
});
