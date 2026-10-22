vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => (permission === "doors.open" ? mocks.doors : mocks.admin), loading: false }) }));
vi.mock("@/hooks/useProjectAccess", () => ({
  useProjectAccess: () => ({ canManage: mocks.admin }),
}));
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Device } from "@/types/device";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
const mocks = vi.hoisted(() => ({
  admin: true,
  doors: true,
  capped: false,
  limited: false,
  device: {} as Device,
}));
vi.mock("convex/react", () => ({
  useQuery: () => ({
    device: mocks.device,
    limits: { doorsCapped: mocks.limited, readersCapped: false },
    doors: [{ _id: "door", name: "Kapı", hikDoorNo: 1, ioId: 0 }],
    readers: [],
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
      ?.find((button) => button.endsWith("Aç</button>"));
    expect(open).toBeDefined();
    expect(open).not.toContain('disabled=""');
  },
);

it("project_user yalnız kapı açma komutunu görür", () => {
  mocks.admin = false;
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
  expect(html).toContain("Aç</button>");
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
});
it("sınırlandırılmış sayaçları 100+ ve liste sınırını bir uyarıyla gösterir", () => {
  mocks.capped = true;
  mocks.limited = true;
  const html = renderToStaticMarkup(
    <DeviceCommandCenter deviceId={mocks.device._id} />,
  );
  expect(html.match(/100\+/g)).toHaveLength(3);
  expect(html).toContain("grid-cols-3");
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
  expect(html).not.toContain("Aç</button>");
  expect(html).toContain("Yeniden başlat");
  mocks.doors = true;
});
