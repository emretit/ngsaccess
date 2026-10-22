vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));
vi.mock("@/hooks/useProjectAccess", () => ({
  useProjectAccess: () => ({ canManage: true }),
}));
import type { MouseEvent, ReactNode } from "react";
import type { FunctionReference } from "convex/server";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Device } from "@/types/device";
import { DeviceTableRow } from "./DeviceTableRow";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
import { QRCodeDialog } from "./QRCodeDialog";
import { DevicesContent } from "./DevicesContent";
import { DeviceFilters } from "./DeviceFilters";
import {
  LocationDoorItem,
  type ReaderRow,
  type DoorNode,
} from "./LocationDoorItem";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  cellClicks: [] as ((event: MouseEvent<HTMLTableCellElement>) => void)[],
}));
vi.mock("@/components/ui/table", async (original) => {
  const actual = await original<typeof import("@/components/ui/table")>();
  return {
    ...actual,
    TableCell: ({
      children,
      onClick,
      ...props
    }: React.ComponentProps<"td">) => {
      if (onClick) mocks.cellClicks.push(onClick);
      return <td {...props}>{children}</td>;
    },
  };
});
vi.mock("convex/react", () => ({
  useQuery: (query: FunctionReference<"query">, args: unknown) => mocks.query(query, args),
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));
vi.mock("@/contexts/ActiveProjectContext", () => ({
  useActiveProject: () => ({ activeProject: { _id: "p" } }),
}));
vi.mock("@/hooks/useDeviceFilters", () => ({
  useDeviceFilters: () => ({
    search: "",
    statusFilter: "all",
    typeFilter: "all",
    deviceTypes: [],
    filteredDevices: [],
    clearFilters: vi.fn(),
    setSearch: vi.fn(),
    setStatusFilter: vi.fn(),
    setTypeFilter: vi.fn(),
  }),
}));
vi.mock("./DeviceList", () => ({ DeviceList: () => null }));
vi.mock("@/components/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Dialog: Part,
    DialogContent: Part,
    DialogTitle: Part,
    DialogHeader: Part,
    DialogDescription: ({ children }: { children?: ReactNode }) => (
      <p data-description>{children}</p>
    ),
  };
});
vi.mock("@/components/ui/select", () => {
  const Part = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Select: Part,
    SelectContent: Part,
    SelectTrigger: Part,
    SelectValue: () => null,
    SelectItem: ({ children }: { children?: ReactNode }) => (
      <option>{children}</option>
    ),
  };
});
const device: Device = {
  _id: "d" as Id<"devices">,
  name: "Ana panel",
  brand: "hikvision",
  hikTransport: "localBridge",
  deviceSerial: "ABC123456789",
  connectionStatus: "offline",
  lastSeen: "2026-06-25T05:40:40Z",
};
const noop = () => {};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.cellClicks = [];
});

describe("cihaz audit görünümü", () => {
  it("listede marka, bölge ve seri sonunu gösterir; çevrimdışını uyarıyla ayırır", () => {
    const html = renderToStaticMarkup(
      <table>
        <tbody>
          <DeviceTableRow
            device={device}
            zoneName="Giriş"
            selected={false}
            onSelect={noop}
            onDeleteDevice={noop}
            onEditDevice={noop}
          />
        </tbody>
      </table>,
    );
    expect(html).toContain("Hikvision");
    expect(html).not.toContain("Model bilgisi yok");
    expect(html).toContain("Giriş · …456789");
    expect(html).toContain('title="25.06.2026 08:40"');
    expect(html).toContain("önce");
    expect(html).toContain("status-warning-badge");
    const never = renderToStaticMarkup(
      <table>
        <tbody>
          <DeviceTableRow
            device={{ ...device, connectionStatus: "never" }}
            selected={false}
            onSelect={noop}
            onDeleteDevice={noop}
            onEditDevice={noop}
          />
        </tbody>
      </table>,
    );
    expect(never).toContain("Henüz bağlanmadı");
    expect(never).not.toContain("status-warning-badge");
    expect(never).not.toContain("önce");
  });
  it("seçim hücresinin boş alanına dokunmak cihazı bir kez seçer", () => {
    const select = vi.fn();
    renderToStaticMarkup(
      <table>
        <tbody>
          <DeviceTableRow
            device={device}
            selected={false}
            onSelect={select}
            onDeleteDevice={noop}
            onEditDevice={noop}
          />
        </tbody>
      </table>,
    );
    const cell = {};
    mocks.cellClicks[0]?.({
      target: cell,
      currentTarget: cell,
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent<HTMLTableCellElement>);
    expect(select).toHaveBeenCalledExactlyOnceWith(true, device._id);
    mocks.cellClicks[0]?.({
      target: {},
      currentTarget: cell,
      stopPropagation: vi.fn(),
    } as unknown as MouseEvent<HTMLTableCellElement>);
    expect(select).toHaveBeenCalledOnce();
  });
  it("çevrimdışı panelde Aç etkin kalır, kuyruğu açıklar ve okuyucu ayarındaki boş planı gizler", () => {
    mocks.query.mockReturnValue({
      device,
      doors: [{ _id: "door", name: "Kapı", hikDoorNo: 2 }],
      readers: [
        {
          _id: "r",
          doorId: "door",
          name: "Okuyucu",
          direction: "entry",
          hikReaderNo: 3,
        },
      ],
      capabilities: null,
      recentEvents: [],
      queues: {
        hikvision: {
          pending: { count: 0 },
          processing: { count: 0 },
          done: { count: 0 },
          failed: { count: 0 },
        },
      },
    });
    const html = renderToStaticMarkup(
      <DeviceCommandCenter deviceId={device._id} />,
    );
    expect(html).toContain(
      'role="status" class="py-3 text-sm text-warning">Cihaz çevrimdışı — komut kuyruğa alınır</p>',
    );
    const openButton = html
      .match(/<button[^>]*>[\s\S]*?<\/button>/g)
      ?.find((button) => button.endsWith("Aç</button>"));
    expect(openButton).toBeDefined();
    expect(openButton).not.toContain('disabled=""');
    expect(html).toContain("Okuyucu ayarını oku");
    expect(html).toContain(
      "Bu bağlantı yöntemi okuyucu ayarını okumayı desteklemiyor.",
    );
    expect(html).toContain("Hik kapı kanalı #2");
    expect(html).toContain("Hik okuyucu kanalı #3");
    expect(html).not.toContain("Plan -");
    expect(html).not.toContain("(TR)");
  });
  it("QR adını ve açıklamasını erişilebilir olarak sunar", () => {
    const html = renderToStaticMarkup(
      <QRCodeDialog
        open
        onOpenChange={noop}
        onDownload={noop}
        qrData={{ serial: "123", name: "NGS QR" }}
      />,
    );
    expect(html).toContain("Kimlik QR kodu — NGS QR");
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="NGS QR kimlik QR kodu"');
    expect(html).toContain("data-description");
  });
  it("konum seçiliyken bağlantı sayıları yalnız o konumdaki cihazları sayar", () => {
    const html = renderToStaticMarkup(
      <DevicesContent
        devices={[
          { ...device, zoneId: "z1" as Id<"zones"> },
          {
            ...device,
            _id: "other" as Id<"devices">,
            zoneId: "z2" as Id<"zones">,
            connectionStatus: "online",
          },
        ]}
        isLoading={false}
        zones={[]}
        selectedZoneId="z1"
        selectedDoorId={null}
        onDeleteDevice={noop}
        onAssignLocation={noop}
        onEditDevice={noop}
        onAddNew={noop}
        onAddFromCloud={noop}
      />,
    );
    expect(html).toContain("Tümü (1)");
    expect(html).toContain("Çevrimiçi (0)");
    expect(html).toContain("Çevrimdışı (1)");
  });
  it("boş sonuçta yalnız temizleme düğmesini gizler, seçeneklerin önekini tekrarlamaz", () => {
    const html = renderToStaticMarkup(
      <DeviceFilters
        statusCounts={{ all: 1, online: 0, offline: 1, never: 0 }}
        search="x"
        onSearchChange={noop}
        statusFilter="all"
        onStatusFilterChange={noop}
        typeFilter="all"
        onTypeFilterChange={noop}
        deviceTypes={[]}
        onAddNew={noop}
        onAddFromCloud={noop}
        deviceCount={1}
        filteredCount={0}
      />,
    );
    expect(html).toContain("button:last-child]:hidden");
    expect(html).not.toContain("<option>Bağlantı:");
    expect(html).not.toContain("<option>Tip:");
  });
  it("kapıyla aynı adı taşıyan okuyucunun adını ve durumunu görünür bırakır", () => {
    const reader: ReaderRow = {
      readerId: "r" as Id<"readers">,
      doorId: "door" as Id<"doors">,
      readerName: "Giriş kapısı",
      readerDirection: "entry",
      online: false,
      lastReadAt: null,
      lastCardNo: null,
      lastEmployeeName: null,
      lastStatus: null,
      lastDirection: null,
      hikCardReaderName: null,
      hikReaderNo: null,
      hikCardReaderPlanTemplateNo: null,
      hikCardReaderAntiSneakEnabled: null,
      hikLastCfgAt: null,
    };
    const door = { _id: "door", name: "Giriş kapısı" } as DoorNode;
    const html = renderToStaticMarkup(
      <ul>
        <LocationDoorItem
          door={door}
          device={null}
          selected={false}
          expanded
          onToggle={noop}
          onSelect={noop}
          readers={[reader]}
          canAddReader={false}
          canManage
          fetchingReaderId={null}
          onAction={noop}
        />
      </ul>,
    );
    expect(html).toContain('<span class="text-foreground">Giriş kapısı</span>');
    expect(html).toContain('class="block text-[10px]">Çevrimdışı');
    expect(html).toContain("[@media(hover:none)]:opacity-100!");
  });
});
