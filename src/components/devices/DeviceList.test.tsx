import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { DeviceList } from "./DeviceList";
import { listSelectionChecked } from "@/hooks/useListSelection";
const mocks = vi.hoisted(() => ({ selected: [] as Id<"devices">[] }));
vi.mock("@/hooks/useDeviceTable", () => ({
  useDeviceTable: (devices: readonly { _id: Id<"devices"> }[]) => ({
    checked: listSelectionChecked(devices.map(device => device._id), new Set(mocks.selected)),
    selectedDevices: mocks.selected,
    showDeleteDialog: false,
    setShowDeleteDialog: vi.fn(),
    handleSelectAll: vi.fn(),
    handleSelectDevice: vi.fn(),
    handleBulkDelete: vi.fn(),
  }),
}));
const device = { _id: "d" as Id<"devices">, name: "Panel" };
const other = { _id: "other" as Id<"devices">, name: "Diğer panel" };
function render(empty = false) {
  return renderToStaticMarkup(
    <DeviceList
      canManage
      devices={[device, other]}
      filteredDevices={empty ? [] : [device, other]}
      isLoading={false}
      zones={[]}
      onDeleteDevice={() => {}}
      onEditDevice={() => {}}
    />,
  );
}
beforeEach(() => {
  mocks.selected = [];
});
describe("cihaz listesi toplu seçim şeridi", () => {
  it("boş ve kısmi seçimde aynı yükseklikte yer ayırır ve mixed durumu kullanır", () => {
    const emptySelection = render();
    mocks.selected = [device._id];
    const partialSelection = render();
    expect(emptySelection).toContain(
      'class="h-[88px] overflow-auto border-b border-line sm:h-[53px]"',
    );
    expect(partialSelection).toContain(
      'class="h-[88px] overflow-auto border-b border-line sm:h-[53px]"',
    );
    expect(partialSelection).toContain('aria-checked="mixed"');
    expect(partialSelection).toContain("data-[state=indeterminate]:before:h-0.5");
    expect(partialSelection).toContain("Seçilenleri sil");
  });
  it("boş sonuçta anlamsız 0–0 gösterimini kaldırır", () => {
    const html = render(true);
    expect(html).toContain("0 sonuç");
    expect(html).not.toContain("gösteriliyor");
  });
});
