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
  sort,
  onSortChange,
}: {
  columnKey: string;
  label: string;
  className?: string;
  sort: string;
  onSortChange?: (sort: string) => void;
}) {
  return (
    <TableHead className={className} aria-sort={employeeColumnSort(sort, key)}>
      <button
        type="button"
        className="min-h-9 text-left"
        onClick={() => onSortChange?.(nextEmployeeSort(sort, key))}
      >
        {label}
        {employeeSortIndicator(sort, key)}
      </button>
    </TableHead>
  );
}
