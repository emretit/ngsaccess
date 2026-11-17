import { TableHead } from "@/components/ui/table";
import {
  employeeColumnSort,
  nextEmployeeSort,
  employeeSortIndicator,
} from "./employeeTableModel";
export function EmployeeSortColumn({
  columnKey: key,
  label,
  className,
  minWidth,
  sort,
  onSortChange,
}: {
  columnKey: string;
  label: string;
  className?: string;
  minWidth?: number;
  sort: string;
  onSortChange?: (sort: string) => void;
}) {
  return (
    <TableHead
      columnId={key}
      minWidth={minWidth}
      resizeLabel={label}
      className={className}
      aria-sort={employeeColumnSort(sort, key)}
    >
      <button
        type="button"
        className="min-h-11 whitespace-nowrap text-left text-xs min-[760px]:min-h-9"
        onClick={() => onSortChange?.(nextEmployeeSort(sort, key))}
      >
        {label}
        {employeeSortIndicator(sort, key)}
      </button>
    </TableHead>
  );
}
