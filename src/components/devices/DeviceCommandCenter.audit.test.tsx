import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Device } from "@/types/device";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
const mocks = vi.hoisted(() => ({ device: {} as Device }));
vi.mock("convex/react", () => ({ useQuery: () => ({ device: mocks.device, doors: [{ _id: "door", name: "Kapı", hikDoorNo: 1, ioId: 0 }], readers: [], capabilities: null, recentEvents: [], queues: { hikvision: { pending: { count: 0 }, processing: { count: 0 }, done: { count: 0 }, failed: { count: 0 } }, ideSmart: { pending: { count: 0 }, sent: { count: 0 }, acked: { count: 0 }, failed: { count: 0 } } } }), useMutation: () => vi.fn(), useAction: () => vi.fn() }));
it.each([
  ["hikvision", "localBridge", "komut kuyruğa alınır"],
  ["hikvision", "gateway", "komut ulaşmayabilir"],
  ["ide_smart", undefined, "komut kuyruğa alınır"],
] as const)("offline wording reflects %s %s transport without disabling commands", (brand, hikTransport, message) => {
  mocks.device = { _id: "d" as Id<"devices">, name: "Panel", brand, hikTransport, connectionStatus: "offline", lastSeen: "2020-01-01T00:00:00Z", hikDevIndex: "gateway-device", ideUuid: "panel-uuid" };
  const html = renderToStaticMarkup(<DeviceCommandCenter device={mocks.device} />);
  expect(html).toContain(`Cihaz çevrimdışı — ${message}`);
  if (hikTransport === "gateway") expect(html).not.toContain("komut kuyruğa alınır");
  const open = html.match(/<button[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.endsWith("Aç</button>"));
  expect(open).toBeDefined(); expect(open).not.toContain('disabled=""');
});
