import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Employee } from "@/types/employee";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

type Rules = FunctionReturnType<typeof api.accessRules.listMemberships>;
type Devices = FunctionReturnType<typeof api.devices.list>;
/** Mirrors the Hikvision sender: active memberships/devices, one target per bridge key. */
export function syncTargetCount(employees: Employee[], rules: Rules, devices: Devices) {
  const deviceIds = new Set(rules.filter(rule => rule.isActive && rule.groupMembers.some(member => employees.some(employee => employee._id === member.employeeId && !!employee.cardNumber))).flatMap(rule => rule.groupDevices.map(link => link.deviceId)));
  return new Set(devices.filter(device => deviceIds.has(device._id) && device.isActive && device.brand === "hikvision").flatMap(device => {
    const key = device.hikTransport === "localBridge" ? device._id : device.hikDevIndex;
    return key ? [key] : [];
  })).size;
}
export function EmployeeSyncConfirmDialog({ employees, onClose, onConfirm }: { employees: Employee[]; onClose: () => void; onConfirm: () => void }) {
  const { projectId } = useActiveProjectScope();
  const rules = useQuery(api.accessRules.listMemberships, projectId ? { projectId } : "skip");
  const devices = useQuery(api.devices.list, projectId ? { projectId } : "skip");
  const inactiveCount = employees.filter(employee => employee.isActive === false).length;
  const activeCount = employees.length - inactiveCount;
  const count = rules && devices ? syncTargetCount(employees, rules, devices) : undefined;
  return <AlertDialog open onOpenChange={open => { if (!open) onClose(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{inactiveCount ? "Cihaz kayıtları güncellensin mi?" : "Cihazlara gönderilsin mi?"}</AlertDialogTitle>
        <AlertDialogDescription>{count === undefined ? "Hedef cihazlar yükleniyor…" : inactiveCount ? `${count} cihazda ${inactiveCount} pasif kişinin kaydı kaldırılacak.${activeCount ? ` ${activeCount} aktif kişinin bilgileri gönderilecek.` : ""}` : `${employees.length} kişinin bilgileri ${count} cihaza gönderilecek.`}</AlertDialogDescription>
      </AlertDialogHeader>
      <p className="break-words text-sm">{employees.map(employee => `${employee.firstName} ${employee.lastName}`).join(", ")}</p>
      <AlertDialogFooter>
        <AlertDialogCancel>Vazgeç</AlertDialogCancel>
        <AlertDialogAction disabled={count === undefined || count === 0} onClick={onConfirm}>{inactiveCount ? "Cihaz kayıtlarını güncelle" : "Cihazlara gönder"}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
