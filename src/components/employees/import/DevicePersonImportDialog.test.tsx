import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps, MouseEvent, ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { ServerDevice } from "@/types/device";
import type { ConfirmActionProps } from "@/components/shared/ConfirmAction";
import { DevicePersonImportDialog } from "./DevicePersonImportDialog";
import { type DeviceImportPreview, type DeviceImportResult } from "./devicePersonImportView";

const mocks = vi.hoisted(() => ({
  devices: [] as ServerDevice[],
  dialogChange: undefined as ((open: boolean) => void) | undefined,
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
  useQuery: () => mocks.devices,
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

vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project" }) }));
vi.mock("@/hooks/useNow", () => ({ useNow: () => 1800000000000 }));
vi.mock("@/components/ui/dialog", () => ({
 Dialog: ({ children, onOpenChange }: { children: ReactNode; onOpenChange: (open: boolean) => void }) => { mocks.dialogChange = onOpenChange; return <div>{children}</div>; },
 DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
 DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
 DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
 DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
const device: ServerDevice = {
  _id: "device" as Id<"devices">,
  name: "ANKA",
  brand: "hikvision",
  hikTransport: "gateway",
  hikDevIndex: "ANKA001",
  hikLastSeenAt: 1800000000000,
};
const preview: DeviceImportPreview = {
  rows: ["Okan ISMAN", "Cinar ZONGUR", "Bengu AYDIN", "Mustafa Bingeloglu"]
    .map((name, index) => ({
      employeeNo: String(index + 1),
      name,
      cards: [],
      fingerCount: 1,
      status: "new" as const,
    }))
    .concat([]),
  totals: { persons: 6, cards: 1 },
};
preview.rows.push(
  {
    employeeNo: "5",
    name: "Mevcut Kişi",
    cards: ["5"],
    fingerCount: 0,
    status: "matched",
  },
  {
    employeeNo: "6",
    name: "Çakışan Kişi",
    cards: [],
    fingerCount: 0,
    status: "conflict",
    reason: "Başka projede kayıtlı",
  },
);
const imported: DeviceImportResult = {
  created: 4,
  matched: 0,
  conflicts: 0,
  manual: 0,
  consentsRecorded: 4,
  fingerprintsStored: 4,
  fingerprintsSkipped: 0,
  ruleId: "rule" as Id<"accessRules">,
};
function render(props: Partial<ComponentProps<typeof DevicePersonImportDialog>> = {}) {
  mocks.cursor = 0;
  mocks.effects = [];
  mocks.confirmations = [];
  mocks.buttons.clear();
  mocks.checks.clear();
  return renderToStaticMarkup(
    <DevicePersonImportDialog open onOpenChange={() => {}} {...props} />,
  );
}
function seedPreview(selected = ["1", "2", "3", "4"], consent = false) {
 mocks.states = ["", false, preview, selected, consent, null, null, null];
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
  mocks.devices = [device];
  mocks.preview.mockResolvedValue(preview);
  mocks.importPersons.mockResolvedValue(imported);
  mocks.backfill.mockResolvedValue({
    ok: true,
    scanned: 605,
    inserted: 174,
    skipped: 431,
  });
});

it("biyometri yetkisi yokken not gösterir ve rızasız aktarır", async () => {
  seedPreview();
  mocks.permissions = ["devices.manage", "employees.manage"];
  const html = render();
  expect(html).toContain(
    "Parmak izi yetkiniz yok; kişiler parmak izi olmadan aktarılır.",
  );
  expect(html).not.toContain(
    "Seçilen kişilerin parmak izi açık rızası alınmıştır",
  );
  await confirm("import");
  expect(mocks.importPersons).toHaveBeenCalledWith({
    deviceId: "device",
    employeeNos: ["1", "2", "3", "4"],
    biometricConsentConfirmed: false,
  });
});
it("seçim azaltıldığında ara durum görünür ve aktarım payload'ından çıkar", async () => {
  seedPreview(["1", "3", "4"]);
  expect(render()).toContain('aria-checked="mixed"');
  await confirm("import");
  expect(mocks.importPersons).toHaveBeenCalledWith({
    deviceId: "device",
    employeeNos: ["1", "3", "4"],
    biometricConsentConfirmed: false,
  });
});
it("aktarımı hata ile sonuçlanırsa seçimi korur", async () => {
  seedPreview(["1"]);
  mocks.importPersons.mockRejectedValue(new Error("Bağlantı kesildi"));
  render();
  expect(await confirm("import")).toBe(false);
  expect(mocks.error).toHaveBeenCalledWith(
    "Aktarım tamamlanamadı",
    "Bağlantı kesildi",
  );
  expect(render()).toContain("Seçilenleri aktar (1)");
});
it("yeni kişi yokken tablo ve açıklama kalır; elle eşleştir ve kısaltma uyarısı görünür", () => {
  seedPreview([]);
  mocks.states[2] = {
    ...preview,
    truncated: true,
    rows: [{ ...preview.rows[0], status: "manual", reason: "Kart no farklı" }],
  };
  const html = render();
  expect(html).toContain("Cihazdaki kişiler");
  expect(html).toContain("Aktarılacak yeni kişi yok.");
  expect(html).toContain("Elle eşleştir");
  expect(html).toContain("İlk 1000 kişi gösteriliyor.");
  expect(html).not.toContain(
    "Seçilen kişilerin parmak izi açık rızası alınmıştır",
  );
});
it("tek cihaz otomatik seçilir; çevrimdışı cihaz ve boş proje açıklanır", () => {
 expect(render()).toContain('value="device" selected=""');
 mocks.devices = [{ ...device, hikLastSeenAt: undefined }];
 mocks.states = [];
 const html = render();
 expect(html).toContain("Cihaz çevrimdışı — aktarım yapılamaz");
 expect(html).toMatch(/disabled=""[^>]*>Cihazdaki kişileri göster/);
 mocks.devices = [];
 expect(render()).toContain("Bu projede kişi çekilebilecek Hikvision cihazı yok.");
});
it("önizleme sürerken diyalog kapatılamaz", async () => {
 let resolvePreview: ((value: DeviceImportPreview) => void) | undefined;
 mocks.preview.mockReturnValue(new Promise<DeviceImportPreview>((resolve) => { resolvePreview = resolve; }));
 const close = vi.fn();
 render({ onOpenChange: close });
 const reading = mocks.buttons.get("Cihazdaki kişileri göster")?.();
 mocks.dialogChange?.(false);
 expect(close).not.toHaveBeenCalled();
 expect(render({ onOpenChange: close })).toContain("Cihaz okunuyor…");
 resolvePreview?.(preview);
 await reading;
 mocks.dialogChange?.(false);
 expect(close).toHaveBeenCalledWith(false);
});

it("önizlemeyi okur, dört yeni kişiyi seçer; kayıtlı/çakışan kutuları pasiftir", async () => {
  render();
  await mocks.buttons.get("Cihazdaki kişileri göster")?.();
  const html = render();
  expect(mocks.preview).toHaveBeenCalledExactlyOnceWith({ deviceId: "device" });
  for (const row of preview.rows) expect(html).toContain(row.name);
  expect(html).toContain("Seçilenleri aktar (4)");
  expect(html.match(/role="checkbox"/g)).toHaveLength(8);
  for (const name of ["Mevcut Kişi", "Çakışan Kişi"])
    expect(html).toMatch(
      new RegExp(`aria-label="${name} seç"[^>]*disabled=""`),
    );
  expect(html).toContain("Başka projede kayıtlı");
});
it("rıza ile aktarır, sonucu gösterir ve önizlemeyi yeniler", async () => {
  render();
  await mocks.buttons.get("Cihazdaki kişileri göster")?.();
  render();
  mocks.checks.get("consent")?.(true);
  mocks.preview.mockResolvedValue({
    ...preview,
    rows: preview.rows.map((row) => ({ ...row, status: "matched" })),
  });
  render();
  mocks.buttons.get("Seçilenleri aktar (4)")?.();
  expect(mocks.importPersons).not.toHaveBeenCalled();
  expect(render()).toContain("Kişiler aktarılsın mı?");
  await confirm("import");
  expect(mocks.importPersons).toHaveBeenCalledExactlyOnceWith({
    deviceId: "device",
    employeeNos: ["1", "2", "3", "4"],
    biometricConsentConfirmed: true,
  });
  expect(mocks.preview).toHaveBeenCalledTimes(2);
  const html = render();
  expect(html).toContain("4 kişi eklendi · 4 parmak izi kaydedildi");
  expect(html).toContain("Aktarılacak yeni kişi yok.");
});
