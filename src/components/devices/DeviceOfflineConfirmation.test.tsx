vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, loading: false }) }));
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import type { Device } from "@/types/device";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceCommandCenter } from "./DeviceCommandCenter";
const mocks = vi.hoisted(() => ({ device: {} as Device, destructive: false }));
vi.mock("convex/react", () => ({ useQuery: () => ({ device: mocks.device, doors: [], readers: [], capabilities: null, recentEvents: [], queues: { hikvision: { pending: { count: 0 }, processing: { count: 0 }, failed: { count: 0 } }, ideSmart: { pending: { count: 0 }, sent: { count: 0 }, failed: { count: 0 } } } }) }));
vi.mock("@/hooks/useProjectAccess", () => ({ useProjectAccess: () => ({ canManage: true }) }));
vi.mock("./useDeviceCommands", () => ({ useDeviceCommands: () => ({ pendingAction: { title: "Onay", description: "İşlem etkisi", destructive: mocks.destructive }, pending: false, setPendingAction: vi.fn(), runConfirmed: vi.fn(), longRunning: false }) }));
vi.mock("./DeviceActionsSection", () => ({ DeviceActionsSection: () => null }));
vi.mock("./DeviceConnectionSection", () => ({ DeviceConnectionSection: () => null }));
vi.mock("@/components/shared/ConfirmDestructive", () => ({ ConfirmDestructive: ({ open, effects }: { open: boolean; effects: string[] }) => open ? <div data-confirm>{effects.join(" ")}</div> : null }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: ({ open, children }: { open: boolean; children?: ReactNode }) => open ? <div data-confirm>{children}</div> : null, AlertDialogCancel: Part, AlertDialogContent: Part, AlertDialogDescription: Part, AlertDialogFooter: Part, AlertDialogHeader: Part, AlertDialogTitle: Part };
});
it.each([
  ["ide_smart", undefined, false, "komut kuyruğa alınır"],
  ["hikvision", "localBridge", false, "komut kuyruğa alınır"],
  ["hikvision", "gateway", false, "komut ulaşmayabilir"],
  ["hikvision", "gateway", true, "komut ulaşmayabilir"],
] as const)("%s %s onayı (yıkıcı: %s) banner ile aynı çevrimdışı açıklamayı sunar", (brand, hikTransport, destructive, message) => {
  mocks.destructive = destructive;
  mocks.device = { _id: "d" as Id<"devices">, name: "Panel", brand, hikTransport, connectionStatus: "offline", lastSeen: "2020-01-01T00:00:00Z" };
  const html = renderToStaticMarkup(<DeviceCommandCenter deviceId={mocks.device._id} />);
  expect(html.split(`Cihaz çevrimdışı — ${message}`)).toHaveLength(3);
  expect(html).not.toContain("komut başarısız olabilir");
});
