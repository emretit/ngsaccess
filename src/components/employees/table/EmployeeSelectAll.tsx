import { TableHead } from "@/components/ui/table";
import { ListSelectAll } from "@/components/shared/ListSelectAll";
export function EmployeeSelectAll({
  disabled,
  checked,
  onSelectAll,
}: {
  disabled: boolean;
  checked: boolean | "indeterminate";
  onSelectAll: (checked: boolean) => void;
}) {
  return (
    <TableHead columnId="select" resizable={false} className="w-11 px-2">
      <ListSelectAll
        label="Bu sayfadaki personeli seç"
        disabled={disabled}
        checked={checked}
        onChange={onSelectAll}
      />
    </TableHead>
  );
}
