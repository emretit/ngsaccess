import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyDoorPlansDialog } from "./CopyDoorPlansDialog";
import { copyPlanFields } from "./bulk";
import { DoorPlansTab } from "./DoorPlansTab";
import type { DoorPlanTarget } from "./DoorPlanDialog";
import type { Id } from "../../../../convex/_generated/dataModel";

const state = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  dirty: false,
  save: vi.fn(),
  status: vi.fn(),
  verify: vi.fn(),
  requestClose: vi.fn(),
  targets: [] as DoorPlanTarget[],
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
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
            ? (next as (value: unknown) => unknown)(state.slots[index])
            : next;
      },
    ];
  },
}));
vi.mock("convex/react", () => ({
  useQuery: () => state.targets,
  useMutation: () => state.save,
  useAction: (reference: unknown) =>
    String(reference).includes("applyVerifyPlan") ? state.verify : state.status,
}));
// Keep the action mocks distinct so accidental status sends fail the verify-only test.
vi.mock("../../../../convex/_generated/api", () => ({
  api: {
    doors: {
      listPlanHolidays: "holidays",
      listPlanTargets: "targets",
      updatePlans: "save",
    },
    actions: {
      hikGatewayDevice: {
        applyDoorStatusPlan: "applyDoorStatusPlan",
        applyVerifyPlan: "applyVerifyPlan",
      },
    },
  },
}));
vi.mock("@/hooks/useActiveProjectScope", () => ({
  useActiveProjectScope: () => ({ projectId: "project", loading: false }),
}));
vi.mock("@/components/shared/UnsavedChangesDialog", () => ({
  useUnsavedChangesGuard: (dirty: boolean) => {
    state.dirty = dirty;
    return { requestClose: state.requestClose, dialog: null };
  },
}));

type Props = Record<string, unknown> & { children?: ReactNode };
function nodes(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  return isValidElement<Props>(node)
    ? [node, ...nodes(node.props.children)]
    : [];
}
function find(
  tree: ReactNode,
  predicate: (node: ReactElement<Props>) => boolean,
) {
  const node = nodes(tree).find(predicate);
  if (!node) throw new Error("Element bulunamadı");
  return node;
}
const target = (index: number): DoorPlanTarget => ({
  doorId: `door${index}` as Id<"doors">,
  projectId: "project" as Id<"projects">,
  doorName: `Kapı ${index}`,
  deviceName: `Cihaz ${index}`,
  deviceOnline: true,
  zoneName: null,
  hikPlanSavedAt: null,
  hikPlanAppliedAt: null,
  hikPlanApplyError: null,
  hikPlanFailedAt: null,
  plansPending: false,
  hikDoorHolidayPlan: { enabled: false, year: 2026, mode: "remainClosed" },
  holidaySupported: null,
  hikDoorStatusPlan: {
    enabled: true,
    beginTime: "08:00",
    endTime: "18:00",
    mode: "remainOpen",
  },
  hikVerifyPlan: {
    enabled: true,
    beginTime: "09:00",
    endTime: "17:00",
    verifyMode: index === 0 ? "face" : "card",
  },
});
const close = vi.fn();
function render() {
  state.cursor = 0;
  return CopyDoorPlansDialog({
    targets: state.targets,
    selectedIds: state.targets.map((door) => door.doorId),
    onClose: close,
  });
}
beforeEach(() => {
  state.slots = [];
  state.cursor = 0;
  state.dirty = false;
  state.targets = Array.from({ length: 8 }, (_, index) => target(index));
  state.save.mockReset().mockResolvedValue(["verify"]);
  state.status.mockReset().mockResolvedValue({ ok: true });
  state.verify.mockReset().mockResolvedValue({ ok: true });
  state.requestClose.mockReset();
  close.mockReset();
});
describe("04-O5 kopyalama kapsamı", () => {
  it("kaynağı çıkarır ve tüm hedefleri açılır listede gösterir", () => {
    const tree = render();
    const preview = find(
      tree,
      (node) => node.props["aria-label"] === "Hedef kapılar",
    );
    const html = renderToStaticMarkup(preview);
    expect(html).not.toContain("Kapı 0");
    expect(html).toContain("Kapı 1");
    expect(html).toContain("Kapı 5");
    expect(html).toContain("Kapı 7");
    expect(nodes(tree).some((node) => node.type === "details")).toBe(true);
    expect(nodes(preview).filter((node) => node.type === "li")).toHaveLength(7);
  });
  it("yalnız doğrulama seçildiğinde diğer hedef ayarlarına dokunmadan doğrulamayı kaydeder ve gönderir", async () => {
    for (const label of ["Durum planı", "Tatil planı"]) {
      const row = find(
        render(),
        (node) =>
          node.type === "label" &&
          Array.isArray(node.props.children) &&
          node.props.children.includes(label),
      );
      (
        find(row, (node) => node.type === "input").props.onChange as (event: {
          target: { checked: boolean };
        }) => void
      )({ target: { checked: false } });
    }
    (
      find(render(), (node) => node.props.children === "Kaydet ve gönder").props
        .onClick as () => void
    )();
    await vi.waitFor(() => expect(state.verify).toHaveBeenCalledTimes(7));
    expect(state.status).not.toHaveBeenCalled();
    expect(state.save).toHaveBeenCalledTimes(7);
    for (const [payload] of state.save.mock.calls) {
      expect(payload).toEqual({
        doorId: expect.any(String),
        hikVerifyPlan: state.targets[0]?.hikVerifyPlan,
      });
      expect(payload.doorId).not.toBe("door0");
    }
  });
  it("kaynakta olmayan ve seçilmeyen türleri kopya alanlarına eklemez", () => {
    const source = target(0);
    expect(copyPlanFields(source, target(1), [])).toEqual({});
    expect(
      copyPlanFields(
        {
          ...source,
          hikDoorStatusPlan: null,
          hikVerifyPlan: null,
          hikDoorHolidayPlan: null,
        },
        target(1),
        ["status", "verify", "holiday"],
      ),
    ).toEqual({});
    expect(copyPlanFields(source, source, ["verify"])).toEqual({});
    expect(copyPlanFields(source, target(1), ["holiday"])).toEqual({
      hikDoorHolidayPlan: source.hikDoorHolidayPlan,
    });
  });
  it("tek kaynak kapıyla işlem yapmaz ve hedef seçme açıklamasını gösterir", () => {
    state.targets = [target(0)];
    const tree = render();
    const button = find(
      tree,
      (node) => node.props.children === "Kaydet ve gönder",
    );
    expect(button.props.disabled).toBe(true);
    (button.props.onClick as () => void)();
    expect(state.save).not.toHaveBeenCalled();
    expect(
      nodes(tree).some(
        (node) =>
          node.props.children === "Kaynak dışında en az bir hedef kapı seçin.",
      ),
    ).toBe(true);
  });
  it("04-O6 her kapıda mobil kart ve aynı satırda gönderim bilgisini sunar", () => {
    state.cursor = 0;
    const tree = DoorPlansTab();
    for (const door of state.targets) {
      const status = find(
        tree,
        (node) =>
          node.props["aria-label"] === `${door.doorName} gönderim durumu`,
      );
      expect(status.props.className).toContain("order-2");
      const row = find(
        tree,
        (node) =>
          node.props.className?.toString().includes("flex flex-col") === true &&
          nodes(node).includes(status),
      );
      expect(
        nodes(row).some((node) => node.props.children === door.doorName),
      ).toBe(true);
      expect(row.props.className).toContain("md:table-row");
    }
  });
});
