import { usePermissions } from "@/hooks/usePermissions";
import { BulkBar } from "@/components/shared/BulkBar";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { EmployeeBulkActions } from "../EmployeeBulkActions";
export function EmployeeTableBulkSelection(
  props: ComponentProps<typeof EmployeeBulkActions>,
) {
  const { can } = usePermissions();
  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 max-h-[40vh] overflow-y-auto rounded-md border bg-background shadow-lg md:left-auto md:max-w-3xl">
      {can("employees.manage") ? <EmployeeBulkActions {...props} onSyncToDevices={can("accessRules.manage") ? props.onSyncToDevices : undefined} /> : can("accessRules.manage") ? <BulkBar count={props.selectedCount} onClear={() => props.onClear?.()}><Button variant="outline" disabled={props.pending || props.isSyncing} onClick={props.onSyncToDevices}>Cihazlara gönder</Button></BulkBar> : null}
    </div>
  );
}
