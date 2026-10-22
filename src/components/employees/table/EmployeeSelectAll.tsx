import { TableHead } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
    <TableHead className="w-11 px-2">
      <Checkbox
        aria-label="Bu sayfadaki personeli seç"
        className="data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground data-[state=indeterminate]:before:absolute data-[state=indeterminate]:before:inset-x-[3px] data-[state=indeterminate]:before:top-1/2 data-[state=indeterminate]:before:h-0.5 data-[state=indeterminate]:before:-translate-y-1/2 data-[state=indeterminate]:before:bg-current data-[state=indeterminate]:before:content-[''] [&[data-state=indeterminate]_svg]:hidden"
        disabled={disabled}
        checked={checked}
        onCheckedChange={(checked) => onSelectAll(checked === true)}
      />
    </TableHead>
  );
}
