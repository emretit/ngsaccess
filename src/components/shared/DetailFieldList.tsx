import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailField = { key: string; label: string; value: ReactNode; numeric?: boolean };
type DetailFieldListProps = {
  fields: readonly DetailField[];
  columns?: 1 | 2;
  emptyValue?: ReactNode;
  className?: string;
};

export function DetailFieldList({ fields, columns = 1, emptyValue = "—", className }: DetailFieldListProps) {
  return <dl className={cn("min-w-0", columns === 2 ? "grid gap-4 sm:grid-cols-2" : "space-y-4", className)}>
    {fields.map(({ key, label, value, numeric }) => <div key={key} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-sm break-words", numeric && "tabular-nums")}>
        {value === null || value === undefined || value === "" ? emptyValue : value}
      </dd>
    </div>)}
  </dl>;
}
