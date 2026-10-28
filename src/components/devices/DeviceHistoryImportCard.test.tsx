import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../convex/_generated/dataModel";
import type { ServerDevice } from "@/types/device";
import type { ConfirmActionProps } from "@/components/shared/ConfirmAction";
import { DeviceHistoryImportCard } from "./DeviceHistoryImportCard";
import { historyResultText, historyScopeArgs } from "./deviceImportView";

const mocks = vi.hoisted(() => ({
  permissions: ["devices.manage", "employees.manage", "biometrics.manage"],
  preview: vi.fn(),
  importPersons: vi.fn(),
  backfill: vi.fn(),
  error: vi.fn(),
  states: [] as unknown[],
  cursor: 0,
  effects: [] as (() => void | (() => void))[],
  confirmations: [] as ConfirmActionProps[],
  buttons: new Map<string, () => void>(),
  checks: new Map<string, (checked: boolean) => void>(),
}));
vi.mock("react", async (original) => ({
  ...(await original<typeof import("react")>()),
  useState: (initial: unknown) => {
    const index = mocks.cursor++;
    if (!(index in mocks.states)) mocks.states[index] = initial;
    return [
      mocks.states[index],
      (value: unknown) => {
        mocks.states[index] =
          typeof value === "function" ? value(mocks.states[index]) : value;
      },
    ];
  },
  useEffect: (effect: () => void | (() => void)) => mocks.effects.push(effect),
}));
vi.mock("convex/react", () => ({
  useAction: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    return name.includes("previewDeviceImport")
      ? mocks.preview
      : name.includes("importDevicePersons")
        ? mocks.importPersons
        : mocks.backfill;
  },
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (permission: string) => mocks.permissions.includes(permission),
  }),
}));
vi.mock("@/lib/notify", () => ({ notify: { error: mocks.error } }));
vi.mock("@/components/shared/ConfirmAction", () => ({
  ConfirmAction: (props: ConfirmActionProps) => {
    mocks.confirmations.push(props);
    return props.open ? (
      <div role="alertdialog">
        {props.title}
        {props.description}
      </div>
    ) : null;
  },
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    variant: _variant,
    ...props
  }: ComponentProps<"button"> & { variant?: string }) => {
    mocks.buttons.set(renderToStaticMarkup(<>{children}</>), () =>
      onClick?.({} as MouseEvent<HTMLButtonElement>),
    );
    return <button {...props}>{children}</button>;
  },
}));
vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean | "indeterminate";
    onCheckedChange?: (checked: boolean) => void;
  } & ComponentProps<"button">) => {
    if (onCheckedChange)
      mocks.checks.set(props["aria-label"] ?? "consent", onCheckedChange);
    return (
      <button
        {...props}
        role="checkbox"
        aria-checked={checked === "indeterminate" ? "mixed" : checked}
      />
    );
  },
}));
vi.mock("@/components/ui/toggle-group", () => ({
  ToggleGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ToggleGroupItem: ({ children }: { children: ReactNode }) => (
    <button>{children}</button>
  ),
}));
vi.mock("@/components/ui/date-picker", () => ({
  DateInput: ({
    value,
    max,
    id,
  }: {
    value: string;
    max: string;
    id: string;
  }) => <input id={id} value={value} max={max} readOnly />,
}));

const device: ServerDevice = {
  _id: "device" as Id<"devices">,
  name: "ANKA",
  brand: "hikvision",
  hikTransport: "gateway",
  hikDevIndex: "ANKA001",
};
function render(props: Partial<ComponentProps<typeof DeviceHistoryImportCard>> = {}) {
  mocks.cursor = 0;
  mocks.effects = [];
  mocks.confirmations = [];
  mocks.buttons.clear();
  mocks.checks.clear();
  return renderToStaticMarkup(
    <DeviceHistoryImportCard device={device} connection="online" {...props} />,
  );
}
function confirm(kind: "import" | "history") {
  const action = mocks.confirmations.find(
    (props) =>
      props.title ===
      (kind === "import"
        ? "Kişiler aktarılsın mı?"
        : "Tüm kayıtlar çekilsin mi?"),
  );
  if (!action) throw new Error("Onay bulunamadı");
  return action.onConfirm();
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.permissions = [
    "devices.manage",
    "employees.manage",
    "biometrics.manage",
  ];
  mocks.states = [];
  mocks.backfill.mockResolvedValue({
    ok: true,
    scanned: 605,
    inserted: 174,
    skipped: 431,
  });
});

it("Tümü onayından sonra fromAll gönderir; tarih ve son 24 saat doğru saatle oluşturulur", async () => {
  expect(historyScopeArgs("all", "")).toEqual({ fromAll: true });
  expect(historyScopeArgs("date", "2026-09-01")).toEqual({
    startTime: "2026-09-01T00:00:00+03:00",
  });
  expect(
    historyScopeArgs("recent", "", Date.parse("2026-10-28T12:00:00Z")),
  ).toEqual({ startTime: "2026-10-27T12:00:00.000Z" });
  mocks.states[3] = "all";
  render();
  mocks.buttons.get("Kayıtları çek")?.();
  expect(mocks.backfill).not.toHaveBeenCalled();
  expect(render()).toContain("Cihazdaki tüm geçmiş kayıtlar çekilecek.");
  await confirm("history");
  expect(mocks.backfill).toHaveBeenCalledExactlyOnceWith({
    deviceId: "device",
    fromAll: true,
  });
  expect(render()).toContain(
    "605 kayıt tarandı · 174 eklendi · 431 zaten vardı / atlandı",
  );
});
it("tarihten itibaren akışı TR gece yarısını gönderir", async () => {
  mocks.states[3] = "date";
  mocks.states[4] = "2026-09-01";
  render();
  await mocks.buttons.get("Kayıtları çek")?.();
  expect(mocks.backfill).toHaveBeenCalledWith({
    deviceId: "device",
    startTime: "2026-09-01T00:00:00+03:00",
  });
});
it("partial arka plan sonucunu hata olarak bildirmez", async () => {
  mocks.backfill.mockResolvedValue({
    ok: false,
    partial: true,
    scanned: 1500,
    inserted: 10,
    skipped: 1490,
  });
  render();
  await mocks.buttons.get("Kayıtları çek")?.();
  expect(render()).toContain("1500 kayıt tarandı, kalanı arka planda sürüyor.");
  expect(mocks.error).not.toHaveBeenCalled();
});
it("geçmiş kayıtlardaki gerçek hatayı bildirir", async () => {
  mocks.backfill.mockResolvedValue({
    ok: false,
    scanned: 0,
    inserted: 0,
    skipped: 0,
    error: "Cihaz yanıt vermedi",
  });
  render();
  await mocks.buttons.get("Kayıtları çek")?.();
  expect(mocks.error).toHaveBeenCalledWith(
    "Kayıtlar çekilemedi",
    "Cihaz yanıt vermedi",
  );
  expect(
    historyResultText({ ok: false, scanned: 0, inserted: 0, skipped: 0 }),
  ).toBeNull();
});
it("çevrimdışı ve başka komut sürerken pasiftir; kişi aktarımı yoktur", async () => {
 for (const props of [{ connection: "offline" }, { commandPending: true }]) {
   const html = render(props);
   expect(html).toMatch(/disabled=""[^>]*>Kayıtları çek/);
   expect(html).not.toContain("Cihazdaki kişileri göster");
   expect(html).not.toContain("Seçilenleri aktar");
   await mocks.buttons.get("Kayıtları çek")?.();
 }
 expect(mocks.backfill).not.toHaveBeenCalled();
});
it("kişi yönetimi yetkisi olanlara yönlendirme gösterir", () => {
 expect(render()).toContain("Kişileri aktarmak için: Kişiler → Personel ekle → Cihazdan kişileri çek");
 mocks.permissions = ["devices.manage"];
 expect(render()).not.toContain("Kişileri aktarmak için:");
});
it.each([
 { brand: "ide_smart" as const },
 { hikTransport: "localBridge" as const },
 { hikDevIndex: undefined },
])("uygun olmayan cihazda kart gizlenir: %o", (overrides) => {
 expect(render({ device: { ...device, ...overrides } })).toBe("");
});
it("cihaz yetkisi yoksa kart gizlenir", () => {
 mocks.permissions = [];
 expect(render()).toBe("");
});
