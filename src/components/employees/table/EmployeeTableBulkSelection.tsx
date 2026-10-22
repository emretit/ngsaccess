import type { ComponentProps } from "react";
import { EmployeeBulkActions } from "../EmployeeBulkActions";
export function EmployeeTableBulkSelection(
  props: ComponentProps<typeof EmployeeBulkActions>,
) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 max-h-[40vh] overflow-y-auto rounded-md border bg-background shadow-lg md:left-auto md:max-w-3xl">
      <EmployeeBulkActions {...props} />
    </div>
  );
}
