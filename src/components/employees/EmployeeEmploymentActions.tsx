import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { EmployeeTerminateDialog } from "./EmployeeTerminateDialog";
import type { EmploymentEmployee } from "./lib/employment";

export function EmployeeEmploymentActions({ employee }: { employee: EmploymentEmployee }) {
  const [open, setOpen] = useState(false);
  const reinstate = useMutation(api.employeeTermination.reinstate);
  if (employee.isVisitor || (!employee.employmentEndDate && employee.isActive !== true)) return null;
  return <>
    <Button variant="outline" onClick={() => setOpen(true)}>{employee.employmentEndDate ? "Geri al" : "İşten çıkar"}</Button>
    {employee.employmentEndDate ? <ConfirmDestructive open={open} onOpenChange={setOpen} title="İşten ayrılma geri alınsın mı?" objectName={`${employee.firstName} ${employee.lastName}`} effects={["Kişi yeniden aktif olur; kartı cihazlara gönderilir."]} confirmLabel="Geri al" onConfirm={() => reinstate({ employeeId: employee._id })} /> : open && <EmployeeTerminateDialog employee={employee} open onOpenChange={setOpen} />}
  </>;
}
