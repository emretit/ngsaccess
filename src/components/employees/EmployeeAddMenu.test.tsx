import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { EmployeeAddMenu, employeeAddOptions } from "./EmployeeAddMenu";
const mocks = vi.hoisted(() => ({ permissions: ["devices.manage", "employees.manage"], devices: [] as { brand: string; hikTransport?: string; hikDevIndex?: string }[] }));
vi.mock("convex/react", () => ({ useQuery: () => mocks.devices }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: (permission: string) => mocks.permissions.includes(permission) }) }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "project" }) }));
vi.mock("./import/DevicePersonImportDialog", () => ({ DevicePersonImportDialog: () => null }));
vi.mock("@/components/ui/dropdown-menu", () => {
 const Container = ({ children }: { children: ReactNode }) => <div>{children}</div>;
 return { DropdownMenu: Container, DropdownMenuTrigger: Container, DropdownMenuContent: Container, DropdownMenuItem: Container };
});
beforeEach(() => { mocks.permissions = ["devices.manage", "employees.manage"]; mocks.devices = [{ brand: "hikvision", hikTransport: "gateway", hikDevIndex: "1" }]; });
const render = () => renderToStaticMarkup(<EmployeeAddMenu onAddNew={() => {}} />);
it("tetik ve iki seçenek yetkilerle görünür", () => {
 const html = render();
 for (const text of ["Personel ekle", "Yeni kişi ekle", "Formla tek kişi oluştur", "Cihazdan kişileri çek", "Hikvision cihazındaki kişileri aktar"]) expect(html).toContain(text);
 expect(employeeAddOptions({ canDeviceImport: true })).toHaveLength(2);
});
it.each([["devices.manage"], ["employees.manage"], []])("iki yetki olmadan aktarım yok: %j", (...permissions) => {
 mocks.permissions = permissions;
 expect(render()).not.toContain("Cihazdan kişileri çek");
});
it("cihaz sorgusu yapmaz; uygun cihaz yokken de yetkili kullanıcıya aktarımı sunar", () => {
 mocks.devices = [];
 expect(render()).toContain("Cihazdan kişileri çek");
 expect(employeeAddOptions({ canDeviceImport: false })).toHaveLength(1);
});
