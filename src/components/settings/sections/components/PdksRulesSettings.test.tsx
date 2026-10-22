import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../../convex/_generated/dataModel";
import {
  PdksRulesSettings,
  pdksRuleSchema,
  pdksPublishPayload,
  tomorrowInTurkey,
  recommendedPunchRules,
  type PdksRuleValues,
} from "./PdksRulesSettings";
import { PDKSEnhancedExportPanel } from "@/components/pdks/dashboard/PDKSEnhancedExportPanel";

const state = vi.hoisted(() => ({
  admin: true,
  cursor: 0,
  values: [] as unknown[],
  actions: [] as {
    label: string;
    disabled?: boolean;
    invoke: (event: { preventDefault: () => void }) => unknown;
  }[],
  selects: new Map<string, (value: string) => void>(),
  query: vi.fn(),
  mutate: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const index = state.cursor++;
      if (!(index in state.values))
        state.values[index] =
          typeof initial === "function" ? (initial as () => T)() : initial;
      return [
        state.values[index],
        (next: T | ((old: T) => T)) => {
          state.values[index] =
            typeof next === "function"
              ? (next as (old: T) => T)(state.values[index] as T)
              : next;
        },
      ];
    },
  };
});
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => state.query(...args),
  useMutation: () => state.mutate,
  useConvex: () => ({ query: state.fetch }),
}));
vi.mock("@/hooks/useActiveProjectScope", () => ({
  useActiveProjectScope: () => ({ projectId: "project", isAdmin: state.admin }),
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({
    projectId: "project",
    activeProject: { name: "Merkez" },
  }),
}));
vi.mock("@/components/auth/AuthProvider", () => ({
  useAuth: () => ({ profile: { _id: "user", role: "project_admin" } }),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    state.selects.set(value, onValueChange);
    return <div data-value={value}>{children}</div>;
  },
  SelectTrigger: ({ children, id }: { children: ReactNode; id: string }) => (
    <button id={id}>{children}</button>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    disabled,
    ...props
  }: {
    checked?: boolean;
    disabled?: boolean;
    "aria-describedby"?: string;
  }) => (
    <input
      type="checkbox"
      checked={checked ?? false}
      disabled={disabled}
      readOnly
      aria-describedby={props["aria-describedby"]}
    />
  ),
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: ReactNode;
    onClick?: (event: { preventDefault: () => void }) => unknown;
    disabled?: boolean;
    "aria-label"?: string;
    type?: "button" | "submit";
  }) => {
    if (onClick)
      state.actions.push({
        label: props["aria-label"] ?? String(children),
        disabled: props.disabled,
        invoke: onClick,
      });
    return <button {...props}>{children}</button>;
  },
}));
vi.mock("@/components/ui/alert-dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    AlertDialog: ({
      open,
      children,
    }: {
      open: boolean;
      children: ReactNode;
    }) => (open ? <div>{children}</div> : null),
    AlertDialogContent: Box,
    AlertDialogHeader: Box,
    AlertDialogTitle: Box,
    AlertDialogDescription: Box,
    AlertDialogFooter: Box,
    AlertDialogCancel: Box,
    AlertDialogAction: ({
      children,
      onClick,
      disabled,
    }: {
      children: ReactNode;
      onClick: (event: { preventDefault: () => void }) => unknown;
      disabled?: boolean;
    }) => {
      state.actions.push({
        label: String(children),
        disabled,
        invoke: onClick,
      });
      return <button disabled={disabled}>{children}</button>;
    },
  };
});
vi.mock("@/components/ui/dialog", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Box,
    DialogHeader: Box,
    DialogTitle: Box,
    DialogDescription: Box,
    DialogFooter: Box,
  };
});
vi.mock("@/components/ui/dropdown-menu", () => {
  const Box = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  return {
    DropdownMenu: Box,
    DropdownMenuContent: Box,
    DropdownMenuTrigger: Box,
    DropdownMenuSeparator: () => null,
    DropdownMenuItem: Box,
  };
});
const rules = {
  current: null,
  future: [
    {
      _id: "future",
      effectiveFrom: "2026-11-01",
      punchMode: "legacy",
      checkpointMode: "all",
      targets: [],
    },
  ],
  history: [],
};
const targets = {
  devices: [
    { deviceId: "device", name: "Ana cihaz", selectable: true, reason: null },
  ],
  doors: [
    {
      doorId: "door",
      deviceId: "device",
      name: "İç kapı",
      selectable: false,
      reason: "Kapı yönü ayırt edilemiyor.",
    },
  ],
};
const render = (node: ReactNode) => {
  state.cursor = 0;
  state.actions = [];
  state.selects.clear();
  return renderToStaticMarkup(node);
};
const values = (): PdksRuleValues => ({
  effectiveFrom: tomorrowInTurkey(),
  punchMode: "legacy",
  ...recommendedPunchRules,
  checkpointMode: "all",
  targets: [],
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  state.admin = true;
  state.values = [];
  state.query.mockReset();
  state.mutate.mockReset();
  state.mutate.mockResolvedValue(null);
  state.fetch.mockReset();
  state.query.mockImplementation((_api, args: unknown) =>
    args === "skip"
      ? undefined
      : state.query.mock.calls.length % 2 === 1
        ? rules
        : targets,
  );
});
afterEach(() => vi.useRealTimers());
describe("PDKS kural ayarları", () => {
  it("Türkiye günüyle yarını varsayılan gösterir ve mevcut davranışı korur", () => {
    expect(tomorrowInTurkey(new Date("2026-10-31T21:30:00Z"))).toBe(
      "2026-11-02",
    );
    const html = render(<PdksRulesSettings />);
    expect(html).toContain('min="2026-10-23"');
    expect(html).toContain('value="2026-10-23"');
    expect(html).toContain("Şu an geçerli:");
    expect(html).toContain("Mevcut davranış");
  });
  it.each(["2026-10-21", "2026-10-22", "2026-02-30"])(
    "geçmiş veya geçersiz tarihi reddeder: %s",
    (date) => {
      expect(
        pdksRuleSchema.safeParse({ ...values(), effectiveFrom: date }).success,
      ).toBe(false);
    },
  );
  it("kurallar moduna her geçişte önerileri doldurur", () => {
    render(<PdksRulesSettings />);
    state.selects.get("legacy")?.("requirements");
    render(<PdksRulesSettings />);
    expect(state.values[0]).toMatchObject({
      punchMode: "requirements",
      ...recommendedPunchRules,
    });
    state.selects.get("requirements")?.("legacy");
    render(<PdksRulesSettings />);
    state.values[0] = { ...values(), requireCheckIn: false, noPunch: "review" };
    render(<PdksRulesSettings />);
    state.selects.get("legacy")?.("requirements");
    expect(state.values[0]).toMatchObject(recommendedPunchRules);
  });
  it("boş ve 500 üstü hedefi reddeder; seçilemeyen kapının nedenini gösterir", () => {
    expect(
      pdksRuleSchema.safeParse({ ...values(), checkpointMode: "selected" })
        .success,
    ).toBe(false);
    expect(
      pdksRuleSchema.safeParse({
        ...values(),
        checkpointMode: "selected",
        targets: Array.from({ length: 501 }, () => ({
          targetType: "device",
          deviceId: "device",
        })),
      }).success,
    ).toBe(false);
    render(<PdksRulesSettings />);
    state.selects.get("all")?.("selected");
    const html = render(<PdksRulesSettings />);
    expect(html).toContain("Kapı yönü ayırt edilemiyor.");
    expect(html).toMatch(/type="checkbox" disabled=""/);
    expect(html).toContain("Mobil ve QR");
    expect(html).toMatch(/disabled="">Yeni sürümü yayınla/);
  });
  it("API payloadı yalnız aktif moda ait doğrulanmış alanları içerir", () => {
    const project = "project" as Id<"projects">;
    expect(pdksPublishPayload(project, pdksRuleSchema.parse(values()))).toEqual(
      {
        projectId: project,
        effectiveFrom: "2026-10-23",
        punchMode: "legacy",
        checkpointMode: "all",
      },
    );
    const data = pdksRuleSchema.parse({
      ...values(),
      punchMode: "requirements",
      checkpointMode: "selected",
      targets: [{ targetType: "door", deviceId: "device", doorId: "door" }],
    });
    expect(pdksPublishPayload(project, data)).toEqual({
      projectId: project,
      ...data,
    });
  });
  it("gelecek sürümü yalnız onaydan sonra siler", async () => {
    render(<PdksRulesSettings />);
    state.actions
      .find((action) => action.label === "2026-11-01 sürümünü sil")
      ?.invoke({ preventDefault: vi.fn() });
    expect(state.mutate).not.toHaveBeenCalled();
    expect(render(<PdksRulesSettings />)).toContain(
      "Gelecek sürüm silinsin mi?",
    );
    await state.actions
      .find((action) => action.label === "Sürümü sil")
      ?.invoke({ preventDefault: vi.fn() });
    expect(state.mutate).toHaveBeenCalledWith({ ruleVersionId: "future" });
  });
  it("aynı tarih onayında kayda alınmış payloadı yayınlar", async () => {
    render(<PdksRulesSettings />);
    const data = { ...values(), effectiveFrom: "2026-11-01" };
    state.values[4] = { kind: "publish", values: data };
    expect(render(<PdksRulesSettings />)).toContain(
      "o tarihteki sürümün yerine geçer",
    );
    await state.actions
      .find((action) => action.label === "Yerine yayınla")
      ?.invoke({ preventDefault: vi.fn() });
    expect(state.mutate).toHaveBeenCalledWith(
      pdksPublishPayload("project" as Id<"projects">, data),
    );
  });
  it("project_user için bölümü gizler ve iki sorguyu da atlar", () => {
    state.admin = false;
    expect(render(<PdksRulesSettings />)).toBe("");
    expect(state.query.mock.calls.map((call) => call[1])).toEqual([
      "skip",
      "skip",
    ]);
  });
});
describe("APHB inceleme engeli", () => {
  function preview(employees?: { employeeId: string; reviewDays: string[] }[]) {
    // ExportPanel state order: preferences, type, pending, error, aphb.
    state.values = [
      undefined,
      "aphb",
      false,
      "",
      {
        xml: "<xml/>",
        filename: "aphb.xml",
        warnings: ["Mevcut uyarı"],
        ...(employees ? { employees } : {}),
      },
    ];
    return render(
      <PDKSEnhancedExportPanel
        records={[
          {
            id: "row",
            employeeId: "e",
            name: "Ayşe Yılmaz",
            department: "",
            firstEntry: "",
            lastExit: "",
            totalHours: "",
            overtime: "",
            leaveType: "",
            status: "",
          },
        ]}
      />,
    );
  }
  it("çalışan adı ve ilk 10 günü listeler, kalanı sayar ve indirmeyi kapatır", () => {
    const html = preview([
      {
        employeeId: "e",
        reviewDays: Array.from(
          { length: 12 },
          (_, index) => `2026-10-${String(index + 1).padStart(2, "0")}`,
        ),
      },
      { employeeId: "other", reviewDays: ["2026-10-01"] },
    ]);
    expect(html).toContain("2 çalışanın günleri");
    expect(html).toContain("Ayşe Yılmaz");
    expect(html).toContain("2026-10-10");
    expect(html).not.toContain("2026-10-11");
    expect(html).toContain("ve 3 gün daha");
    expect(html).toContain("Bu günler kesinleşmeden bildirim indirilemez.");
    expect(html).toMatch(/disabled="">İndir/);
    expect(html).toContain("Mevcut uyarı");
  });
  it("adı bulunmayan çalışana sıra sayısı verir", () => {
    expect(
      preview([{ employeeId: "other", reviewDays: ["2026-10-02"] }]),
    ).toContain("Çalışan 1");
  });
  it.each([undefined, [], [{ employeeId: "e", reviewDays: [] }]])(
    "inceleme yoksa mevcut indirme açık: %j",
    (employees) => {
      const html = preview(employees);
      expect(html).not.toContain("kesinleşmeden bildirim indirilemez");
      expect(html).not.toMatch(/disabled="">İndir/);
      expect(html).toContain("İndir");
    },
  );
});

it.each([true, undefined])(
  "APHB boş XML ve inceleme engelini hata yerine önizlemeye taşır: %s",
  async (blockedByReview) => {
    state.values = [undefined, "aphb", false, "", null];
    state.fetch.mockResolvedValue({
      xml: "",
      filename: "aphb.xml",
      warnings: ["İnceleme günleri var"],
      employees: [{ employeeId: "e", reviewDays: ["2026-10-21"] }],
      ...(blockedByReview === undefined ? {} : { blockedByReview }),
    });
    render(<PDKSEnhancedExportPanel />);
    state.actions
      .find((action) => action.label === "Önizlemeyi hazırla")
      ?.invoke({ preventDefault: vi.fn() });
    await Promise.resolve();
    await Promise.resolve();
    const html = render(<PDKSEnhancedExportPanel />);
    expect(state.fetch).toHaveBeenCalledOnce();
    expect(html).toContain("2026-10-21");
    expect(html).toContain("İnceleme günleri var");
    expect(html).not.toContain("Bildirim için veri bulunamadı");
    expect(html).toMatch(/disabled="">İndir/);
  },
);

it("APHB boş XML inceleme yoksa mevcut veri yok hatasını gösterir", async () => {
  state.values = [undefined, "aphb", false, "", null];
  state.fetch.mockResolvedValue({
    xml: "",
    filename: "aphb.xml",
    warnings: [],
    employees: [],
    blockedByReview: false,
  });
  render(<PDKSEnhancedExportPanel />);
  state.actions
    .find((action) => action.label === "Önizlemeyi hazırla")
    ?.invoke({ preventDefault: vi.fn() });
  await Promise.resolve();
  await Promise.resolve();
  expect(render(<PDKSEnhancedExportPanel />)).toContain(
    "Bildirim için veri bulunamadı",
  );
});
