import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { EmployeeTerminateDialog } from "./EmployeeTerminateDialog";
import { EmployeeTransferDialog } from "./EmployeeTransferDialog";
import { isTransferActive, type EmploymentEmployee } from "./lib/employment";

export function EmployeeEmploymentActions({ employee }: { employee: EmploymentEmployee }) {
  const [open, setOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const reinstate = useMutation(api.employeeTermination.reinstate);
  const transfer = useQuery(api.employeeTermination.getEmployeeTransfer, { employeeId: employee._id });
  const projects = useQuery(api.projects.listActive, {});
  const permissions = useQuery(api.roles.myPermissionsByProject, {});
  const activeTransfer = isTransferActive(transfer);
  const canAct = !employee.isVisitor && employee.terminationType !== "transfer" && !activeTransfer && transfer !== undefined && (!!employee.employmentEndDate || employee.isActive === true);
  const canTransfer = canAct && !employee.employmentEndDate && employee.isActive === true && !!employee.projectId &&
    projects?.some(project => project._id !== employee.projectId && permissions?.some(row => row.projectId === project._id && row.permissions.includes("employees.manage"))) &&
    permissions?.some(row => row.projectId === employee.projectId && row.permissions.includes("employees.manage"));
  return <>
    {canAct && <>
      <Button className="max-sm:min-h-11" variant="outline" onClick={() => setOpen(true)}>{employee.employmentEndDate ? "Geri al" : "İşten çıkar"}</Button>
      {employee.employmentEndDate ? <ConfirmDestructive open={open} onOpenChange={setOpen} title="İşten ayrılma geri alınsın mı?" objectName={`${employee.firstName} ${employee.lastName}`} effects={["Kişi yeniden aktif olur; kartı cihazlara gönderilir."]} confirmLabel="Geri al" onConfirm={() => reinstate({ employeeId: employee._id })} /> : open && <EmployeeTerminateDialog employee={employee} open onOpenChange={setOpen} />}
    </>}
    {canTransfer && <Button className="max-sm:min-h-11" variant="outline" onClick={() => setTransferOpen(true)}>Başka projeye taşı</Button>}
    {transferOpen && projects && permissions && <EmployeeTransferDialog employee={employee} projects={projects} permissions={permissions} open onOpenChange={setTransferOpen} />}
  </>;
}
