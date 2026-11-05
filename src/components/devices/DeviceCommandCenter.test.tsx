vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => (permission === "doors.open" ? mocks.doors : permission === "employees.manage" ? mocks.employees : mocks.admin), loading: false }) }));
vi.mock("@/hooks/useProjectAccess", () => ({
  useProjectAccess: () => ({ canManage: mocks.admin }),
}));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Device } from "@/types/device";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
const mocks = vi.hoisted(() => ({
  admin: true,
  doors: true,
  employees: true,
  capped: false,
  limited: false,
  device: {} as Device,
  confirmation: false,
  destructive: false,
  readers: [] as { _id: string; doorId: string; name: string; direction: string; hikReaderNo: number }[],
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({
    device: mocks.device,
    limits: { doorsCapped: mocks.limited, readersCapped: false },
    doors: [{ _id: "door", name: "Kapı", hikDoorNo: 1, ioId: 0 }],
    readers: mocks.readers,
    capabilities: null,
    recentEvents: [],
    queues: {
      hikvision: {
        pending: { count: 0, capped: mocks.capped },
        processing: { count: 0, capped: mocks.capped },
        done: { count: 0, capped: mocks.capped },
        failed: { count: 0, capped: mocks.capped },
      },
      ideSmart: {
        pending: { count: 0, capped: mocks.capped },
        sent: { count: 0, capped: mocks.capped },
        acked: { count: 0, capped: mocks.capped },
        failed: { count: 0, capped: mocks.capped },
      },
    },
  }),
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));
it.each([
  ["hikvision", "localBridge", "komut kuyruğa alınır"],
  ["hikvision", "gateway", "komut ulaşmayabilir"],
  ["ide_smart", undefined, "komut kuyruğa alınır"],
] as const)(
  "offline wording reflects %s %s transport without disabling commands",
  (brand, hikTransport, message) => {
    mocks.device = {
      _id: "d" as Id<"devices">,
      name: "Panel",
      brand,
      hikTransport,
      connectionStatus: "offline",
      lastSeen: "2020-01-01T00:00:00Z",
      hikDevIndex: "gateway-device",
      ideUuid: "panel-uuid",
    };
    const html = renderToStaticMarkup(
      <DeviceCommandCenter deviceId={mocks.device._id} />,
    );
    expect(html).toContain(`Cihaz çevrimdışı — ${message}`);
    if (hikTransport === "gateway")
      expect(html).not.toContain("komut kuyruğa alınır");
    const open = html
      .match(/<button[^>]*>[\s\S]*?<\/button>/g)
      ?.find((button) => button.includes("Kapıyı aç"));
    expect(open).toBeDefined();
    expect(open).not.toContain('disabled=""');
  },
);

it("project_user yalnız kapı açma komutunu görür", () => {
  mocks.admin = false;
  mocks.employees = false;
  mocks.device = {
    _id: "d" as Id<"devices">,
    name: "Panel",
    brand: "hikvision",
    hikTransport: "gateway",
    hikDevIndex: "index",
  };
  const html = renderToStaticMarkup(
    <DeviceCommandCenter deviceId={mocks.device._id} />,
  );
  expect(html).toContain("Kapıyı aç");
  for (const label of [
    "Özellikleri tara",
    "Çalışma durumu",
    "Eşitlik kontrolü",
    "Yeniden başlat",
    "Olayları tara",
    "Kart okut",
    "Panel senkronu",
    "Okuyucu ayarını oku",
  ])
    expect(html).not.toContain(label);
  mocks.admin = true;
  mocks.employees = true;
});
it("komut kuyruğunu göstermez, liste sınırını bir uyarıyla gösterir", () => {
  mocks.capped = true;
  mocks.limited = true;
  const html = renderToStaticMarkup(
    <DeviceCommandCenter deviceId={mocks.device._id} />,
  );
  expect(html).not.toContain("Komut kuyruğu");
  expect(html).not.toContain("100+");
  expect(html).toContain(
    "Bu cihazda gösterilenden fazla kapı/okuyucu var; liste kısaltıldı.",
  );
  mocks.capped = false;
  mocks.limited = false;
});

it("cihaz yöneticisi kapı açma yetkisi kaldırıldığında açma düğmesini görmez", () => {
  mocks.admin = true;
  mocks.doors = false;
  mocks.device = { _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index" };
  const html = renderToStaticMarkup(<DeviceCommandCenter deviceId={mocks.device._id} />);
  expect(html).not.toContain("Kapıyı aç");
  expect(html).toContain("Yeniden başlat");
  mocks.doors = true;
});

 it.each([[true, false], [false, true], [true, true], [false, false]])("CIH-11 capture follows employees.manage (devices=%s employees=%s)", (devices, employees) => {
  mocks.admin = devices;
  mocks.employees = employees;
  mocks.device = { _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index" };
  const html = renderToStaticMarkup(<DeviceCommandCenter deviceId={mocks.device._id} />);
  expect(html.includes("Kart okut")).toBe(employees);
  mocks.admin = true;
  mocks.employees = true;
});

vi.mock("./useDeviceCommands", async original => {
  const actual = await original<typeof import("./useDeviceCommands")>();
  return {
    ...actual,
    useDeviceCommands: (...args: Parameters<typeof actual.useDeviceCommands>) => {
      const commands = actual.useDeviceCommands(...args);
      return {
        ...commands,
        pendingAction: mocks.confirmation
          ? { id: "confirmation", title: "Onay", description: "İşlem etkisi", destructive: mocks.destructive, run: async () => ({ ok: true }) }
          : commands.pendingAction,
      };
    },
  };
});

vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: ({ open, effects }: { open: boolean; effects: string[] }) => open ? <div data-confirm>{effects.join(" ")}</div> : null }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: ({ open, children }: { open: boolean; children?: ReactNode }) => open ? <div data-confirm>{children}</div> : null, AlertDialogCancel: Part, AlertDialogContent: Part, AlertDialogDescription: Part, AlertDialogFooter: Part, AlertDialogHeader: Part, AlertDialogTitle: Part };
});

beforeEach(() => {
  mocks.admin = true;
  mocks.doors = true;
  mocks.employees = true;
  mocks.capped = false;
  mocks.limited = false;
  mocks.confirmation = false;
  mocks.destructive = false;
  mocks.readers = [];
  mocks.device = { _id: "d" as Id<"devices">, name: "Panel", brand: "hikvision", hikTransport: "gateway", hikDevIndex: "index" };
});

it.each([
  ["ide_smart", undefined, false, "komut kuyruğa alınır"],
  ["hikvision", "localBridge", false, "komut kuyruğa alınır"],
  ["hikvision", "gateway", false, "komut ulaşmayabilir"],
  ["hikvision", "gateway", true, "komut ulaşmayabilir"],
] as const)("%s %s onayı (yıkıcı: %s) banner ile aynı çevrimdışı açıklamayı sunar", (brand, hikTransport, destructive, message) => {
  mocks.confirmation = true;
  mocks.destructive = destructive;
  mocks.device = { _id: "d" as Id<"devices">, name: "Panel", brand, hikTransport, connectionStatus: "offline", lastSeen: "2020-01-01T00:00:00Z" };
  const html = renderToStaticMarkup(<DeviceCommandCenter deviceId={mocks.device._id} />);
  expect(html.split(`Cihaz çevrimdışı — ${message}`)).toHaveLength(3);
  expect(html).not.toContain("komut başarısız olabilir");
});

  it("çevrimdışı panelde kapı açma etkin kalır, kuyruğu açıklar ve okuyucu ayarı sınırını gösterir", () => {
    mocks.device = {
      _id: "d" as Id<"devices">,
      name: "Ana panel",
      brand: "hikvision",
      hikTransport: "localBridge",
      deviceSerial: "ABC123456789",
      connectionStatus: "offline",
      lastSeen: "2026-06-25T05:40:40Z",
    };
    mocks.readers = [{ _id: "r", doorId: "door", name: "Okuyucu", direction: "entry", hikReaderNo: 3 }];
    const html = renderToStaticMarkup(
      <DeviceCommandCenter deviceId={mocks.device._id} />,
    );
    expect(html).toContain(
      'role="status" class="py-2 text-sm text-warning">Cihaz çevrimdışı — komut kuyruğa alınır</p>',
    );
    const openButton = html
      .match(/<button[^>]*>[\s\S]*?<\/button>/g)
      ?.find((button) => button.includes("Kapıyı aç"));
    expect(openButton).toBeDefined();
    expect(openButton).not.toContain('disabled=""');
    expect(html).toContain("Okuyucu ayarını oku");
    expect(html).toContain(
      "Yerel köprü bağlantısında okuyucu ayarları",
    );
    expect(html).not.toContain("Plan -");
    expect(html).not.toContain("(TR)");
  });
