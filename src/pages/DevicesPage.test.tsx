import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import DevicesPage from "./Devices";

const state = vi.hoisted(() => ({ projectId: "project" as string | null, access: true }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => false }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: state.projectId, activeProject: { name: "Merkez" }, loading: false }) }));
vi.mock("@/hooks/useProjectAccess", () => ({ useProjectAccess: () => ({ loading: false }) }));
vi.mock("@/hooks/useProjectFilteredDevices", () => ({ useProjectFilteredDevices: () => ({ devices: [], isLoading: false, hasProjectAccess: state.access }) }));
vi.mock("@/hooks/useZonesAndDoors", () => ({ useZonesAndDoors: () => ({ zones: [], doors: [] }) }));
vi.mock("convex/react", () => ({ useMutation: () => vi.fn() }));
vi.mock("@/components/devices/useDeviceDeepLink", () => ({ useDeviceDeepLink: () => vi.fn(), useDeviceUrlSync: () => vi.fn() }));
vi.mock("@/components/devices/useDeviceActions", () => ({ useDeviceActions: () => ({ handleDeleteDevice: vi.fn() }) }));
vi.mock("@/components/devices/useQRCodeDialog", () => ({ useQRCodeDialog: () => ({ selectedQR: null }) }));
vi.mock("@/components/devices/useLocationForm", () => ({ useLocationForm: () => ({ showLocationForm: { open: false } }) }));
vi.mock("@/components/devices/DeviceDetailsPanel", () => ({ DeviceDetailsPanel: () => <div>Korunan ayrıntı paneli</div> }));
vi.mock("@/components/devices/DevicesContent", () => ({ DevicesContent: () => <h1>Cihazlar</h1> }));
vi.mock("@/components/devices/LocationTree", () => ({ LocationTree: () => null }));
vi.mock("@/components/devices/ClaimDeviceDialog", () => ({ ClaimDeviceDialog: () => null }));
vi.mock("@/components/devices/VirtualReaderDialog", () => ({ VirtualReaderDialog: () => null }));
vi.mock("@/components/devices/QRCodeDialog", () => ({ QRCodeDialog: () => null }));
vi.mock("@/components/devices/AssignLocationForm", () => ({ AssignLocationForm: () => null }));
afterEach(() => { state.projectId = "project"; state.access = true; });

it.each(["ready", "denied", "no-project"])("keeps one device heading and the details panel in state: %s", status => {
  state.access = status !== "denied";
  state.projectId = status === "no-project" ? null : "project";
  const html = renderToStaticMarkup(<MemoryRouter><DevicesPage /></MemoryRouter>);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Cihazlar");
  expect(html).not.toMatch(/<main\b/);
  expect(html).toContain("Korunan ayrıntı paneli");
  if (status === "denied") expect(html).toContain("Proje erişimi yok");
  if (status === "no-project") expect(html).toContain("Cihaz envanterini görüntülemek için");
});
