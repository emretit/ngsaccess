import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import { EmployeeSyncConfirmDialog, syncTargetCount } from "./EmployeeSyncConfirmDialog";
const mocks = vi.hoisted(() => ({ rules: [] as unknown[], devices: [] as unknown[], confirm: undefined as (() => void) | undefined, disabled: false }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0]) => getFunctionName(ref) === "accessRules:listMemberships" ? mocks.rules : mocks.devices }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ projectId: "p" }) }));
vi.mock("@/components/ui/alert-dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { AlertDialog: Part, AlertDialogContent: Part, AlertDialogHeader: Part, AlertDialogTitle: Part, AlertDialogDescription: Part, AlertDialogFooter: Part, AlertDialogCancel: Part, AlertDialogAction: ({ children, disabled, onClick }: { children: ReactNode; disabled: boolean; onClick: () => void }) => { mocks.confirm = onClick; mocks.disabled = disabled; return <button disabled={disabled}>{children}</button>; } };
});
const employee: Employee = { _id: "e" as Id<"employees">, firstName: "Ada", lastName: "Test", email: "ada@test.test", cardNumber: "1", isActive: true };
const rule = { isActive: true, groupMembers: [{ employeeId: "e" }], groupDevices: [{ deviceId: "d" }, { deviceId: "d2" }, { deviceId: "inactive" }, { deviceId: "ide" }] };
const devices = [{ _id: "d", isActive: true, brand: "hikvision", hikDevIndex: "gateway-1" }, { _id: "d2", isActive: true, brand: "hikvision", hikDevIndex: "gateway-1" }, { _id: "inactive", isActive: false, brand: "hikvision", hikDevIndex: "gateway-2" }, { _id: "ide", isActive: true, brand: "ide_smart" }];
beforeEach(() => { mocks.rules = [rule]; mocks.devices = devices; mocks.confirm = undefined; });
it.each([[employee], [employee, { ...employee, _id: "e2" as Id<"employees"> }]])("02-O2: shows target summary before either single or bulk confirmation", (...employees) => {
  const confirm = vi.fn();
  const html = renderToStaticMarkup(<EmployeeSyncConfirmDialog employees={employees} onClose={() => {}} onConfirm={confirm} />);
  expect(confirm).not.toHaveBeenCalled();
  expect(html).toContain(`${employees.length} kişinin bilgileri 1 cihaza gönderilecek.`);
  expect(mocks.disabled).toBe(false);
  mocks.confirm?.();
  expect(confirm).toHaveBeenCalledOnce();
});
it("02-O2: deduplicates targets and skips inactive or unsupported devices and cardless people", () => {
  expect(syncTargetCount([employee], [rule] as Parameters<typeof syncTargetCount>[1], devices as Parameters<typeof syncTargetCount>[2])).toBe(1);
  expect(syncTargetCount([{ ...employee, cardNumber: "" }], [rule] as Parameters<typeof syncTargetCount>[1], devices as Parameters<typeof syncTargetCount>[2])).toBe(0);
});

it("pasif kişilerin kaldırılacağını ve karma seçimde iki işlemi de açıklar", () => {
  const inactive = { ...employee, isActive: false };
  const render = (employees: Employee[]) => renderToStaticMarkup(<EmployeeSyncConfirmDialog employees={employees} onClose={() => {}} onConfirm={() => {}} />);
  expect(render([inactive])).toContain("1 cihazda 1 pasif kişinin kaydı kaldırılacak.");
  expect(render([inactive])).not.toContain("bilgileri 1 cihaza gönderilecek");
  expect(render([inactive, { ...employee, _id: "e2" as Id<"employees"> }])).toContain("1 pasif kişinin kaydı kaldırılacak. 1 aktif kişinin bilgileri gönderilecek.");
});
