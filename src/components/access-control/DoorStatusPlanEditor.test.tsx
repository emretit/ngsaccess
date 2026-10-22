import { isValidElement, type ReactNode, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeEach } from "vitest";
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
  useProjectAccess: () => ({ isAdmin: true }),
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
  return {
    tree: () => DoorStatusPlanEditor({ value, onChange }),
    value: () => value,
  };
}
function click(tree: ReactNode, label: string) {
  const button = find(
    tree,
    (element) =>
      element.props["aria-label"] === label || element.props.children === label,
  );
  (button.props.onClick as () => void)();
}
beforeEach(() => {
  state.slots = [];
  state.cursor = 0;
  state.dirty = false;
  state.save.mockReset().mockResolvedValue(undefined);
  state.apply.mockReset().mockResolvedValue({ ok: true });
});
describe("DoorStatusPlanEditor", () => {
  it("Her gün aynı ile Gün bazında arasında geçer ve yedi günü doldurur", () => {
    const editor = edit();
    const change = (value: string) =>
      (
        find(
          editor.tree(),
          (element) =>
            element.props["aria-label"] === "Kapı durum planı düzeni",
        ).props.onChange as (event: { target: { value: string } }) => void
      )({ target: { value } });
    change("weekly");
    expect(editor.value().weekly).toHaveLength(7);
    expect(
      editor
        .value()
        .weekly?.every((day) => day.segments[0]?.beginTime === "08:00:00"),
    ).toBe(true);
    change("daily");
    expect(editor.value().weekly).toBeUndefined();
    expect(editor.value().beginTime).toBe("08:00:00");
  });
  it("boş gün, ekle/sil, sekiz aralık sınırı ve pazartesi kopyası", () => {
    const editor = edit({
      ...legacy,
      weekly: [
        {
          day: "Monday",
          segments: [
            { beginTime: "09:00", endTime: "12:00", mode: "remainClosed" },
          ],
        },
      ],
    });
    click(editor.tree(), "Salı aralık ekle");
    expect(
      editor.value().weekly?.find((day) => day.day === "Tuesday")?.segments,
    ).toHaveLength(1);
    click(editor.tree(), "Salı 1. aralığı sil");
    expect(
      editor.value().weekly?.find((day) => day.day === "Tuesday")?.segments,
    ).toEqual([]);
    click(editor.tree(), "Pazartesiyi hafta içine (Salı–Cuma) kopyala");
    const weekend = new Set(["Saturday", "Sunday"]);
    expect(
      editor
        .value()
        .weekly?.filter((day) => !weekend.has(day.day))
        .every((day) => day.segments[0]?.mode === "remainClosed"),
    ).toBe(true);
    expect(
      editor
        .value()
        .weekly?.filter((day) => weekend.has(day.day))
        .every((day) => day.segments.length === 0),
    ).toBe(true);
    for (let i = 1; i < 8; i++) click(editor.tree(), "Salı aralık ekle");
    expect(
      find(
        editor.tree(),
        (element) => element.props["aria-label"] === "Salı aralık ekle",
      ).props.disabled,
    ).toBe(true);
    const html = renderToStaticMarkup(editor.tree());
    expect(html).toContain('aria-label="Pazartesi 1. aralık başlangıç"');
    expect(html).toContain('aria-label="Cuma 1. aralık mod"');
    expect(html).not.toContain('aria-label="Pazar 1. aralık mod"');
  });
  it("boş pazartesiyi Salı–Cuma'ya kopyalar, hafta sonunu korur", () => {
    const editor = edit({
      ...legacy,
      weekly: [{ day: "Tuesday", segments: [legacy] }, { day: "Saturday", segments: [legacy] }],
    });
    click(editor.tree(), "Pazartesiyi hafta içine (Salı–Cuma) kopyala");
    const weekly = editor.value().weekly ?? [];
    expect(weekly.filter((day) => day.day !== "Saturday").every((day) => day.segments.length === 0)).toBe(true);
    expect(weekly.find((day) => day.day === "Saturday")?.segments).toHaveLength(1);
  });
});
describe("EditDoorDialog haftalık kayıt", () => {
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
        doorId: door._id,
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
    expect(state.apply).toHaveBeenCalledTimes(2);
  });
});
