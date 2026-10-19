import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadEmployeesXlsx } from "@/lib/employees/exportEmployeesXlsx";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: Id<"projects">;
  employees: readonly Employee[];
  onError: (message: string | null) => void;
};

export function EmployeeExportDialog({ open, onOpenChange, projectId, employees, onError }: Props) {
  const logExport = useMutation(api.employeeImport.logExport);
  const [includeTcNo, setIncludeTcNo] = useState(false);
  const [busy, setBusy] = useState(false);
  const exportFile = async () => {
    setBusy(true);
    onError(null);
    try {
      await logExport({ projectId, rowCount: employees.length });
      await downloadEmployeesXlsx(employees, includeTcNo);
      onOpenChange(false);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Excel dosyası oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader><DialogTitle>Kişileri Excel’e aktar</DialogTitle><DialogDescription>{employees.length} kişi dışa aktarılacak. Dışa aktarma işlemi kaydedilir.</DialogDescription></DialogHeader>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={includeTcNo} onChange={(event) => setIncludeTcNo(event.currentTarget.checked)} />T.C. kimlik no ekle</label>
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>İptal</Button><Button disabled={busy} onClick={() => void exportFile()}>{busy ? "Hazırlanıyor…" : "Dışa aktar"}</Button></div>
    </DialogContent>
  </Dialog>;
}
