import { useState } from "react";
import { Plus, PlusCircle, Download, ChevronDown } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { PageHeaderPrimaryButton } from "@/components/shared/PageHeader";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { DevicePersonImportDialog } from "./import/DevicePersonImportDialog";

export function employeeAddOptions({ canDeviceImport }: { canDeviceImport: boolean }) {
  const options = [{ id: "new", label: "Yeni kişi ekle", description: "Formla tek kişi oluştur" }];
  if (canDeviceImport) options.push({ id: "device", label: "Cihazdan kişileri çek", description: "Hikvision cihazındaki kişileri aktar" });
  return options;
}

export function EmployeeAddMenu({ onAddNew }: { onAddNew: () => void }) {
  const { can } = usePermissions();
  const permitted = can("devices.manage") && can("employees.manage");
  const [importOpen, setImportOpen] = useState(false);
  const canDeviceImport = permitted;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <PageHeaderPrimaryButton><Plus className="h-3.5 w-3.5" />Personel ekle<ChevronDown className="h-3.5 w-3.5 opacity-70" /></PageHeaderPrimaryButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-32px)]">
        {employeeAddOptions({ canDeviceImport }).map((option) => <DropdownMenuItem key={option.id} className="min-h-11 gap-2 py-2" onSelect={() => option.id === "new" ? onAddNew() : setImportOpen(true)}>
          {option.id === "new" ? <PlusCircle className="h-4 w-4 shrink-0 text-primary" /> : <Download className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <div className="flex min-w-0 flex-col"><span className="text-sm font-medium">{option.label}</span><span className="text-xs text-muted-foreground">{option.description}</span></div>
        </DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
    {importOpen && canDeviceImport && <DevicePersonImportDialog open={importOpen} onOpenChange={setImportOpen} />}
  </>;
}
