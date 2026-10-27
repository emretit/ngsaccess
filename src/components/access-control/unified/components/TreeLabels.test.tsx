import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
vi.mock("@/hooks/useDevices", () => ({ useDevices: () => ({ devices: [{ _id: "device", name: "Giriş cihazı", brand: "hikvision" }] }) }));
vi.mock("@/hooks/useZonesAndDoors", () => ({ useZonesAndDoors: () => ({ zones: [], doors: [{ _id: "door", name: "Giriş", deviceId: "device" }] }) }));
vi.mock("@/hooks/useEmployees", () => ({ useEmployees: () => ({ employees: [{ _id: "person", firstName: "Ali", lastName: "Yılmaz" }] }) }));
vi.mock("@/hooks/useDepartments", () => ({ useDepartments: () => ({ departments: [] }) }));
import { DepartmentTree } from "./DepartmentTree";
import { ZoneDeviceTree } from "./ZoneDeviceTree";
it("kişi ağacının görünür iç başlığını kaldırır, grup adını korur", () => {
  const html = renderToStaticMarkup(<DepartmentTree formData={{ selected_employees: [] }} setFormData={() => undefined} />);
  expect(html).not.toContain("Kim erişebilecek?");
  expect(html).toContain('role="group" aria-label="Kişi seçimi"');
  expect(html).toContain("Ali");
});
it("kapı ağacının grup adını korur ve cihaz terimini kullanır", () => {
  const html = renderToStaticMarkup(<ZoneDeviceTree formData={{ selected_devices: [], selected_doors: [] }} setFormData={() => undefined} />);
  expect(html).not.toContain("Hangi kapılarda?");
  expect(html).toContain('role="group" aria-label="Kapı ve cihaz seçimi"');
  expect(html).toContain("Kapı, cihaz veya bölge ara");
  expect(html).not.toMatch(/panel/i);
});
