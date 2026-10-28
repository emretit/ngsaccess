import type { ReactNode } from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";

/**
 * Tablo boşken/yüklenirken başlıklar kalır; durum gövdede tek satırda gösterilir.
 * Parent tabloyu koşullamaz: `rows.length === 0 ? <EmptyState/> : <Table/>` yerine
 * `<TableBody>{loading ? <TableStateRow state="loading"/> : rows.length ? rows : <TableStateRow state="empty"/>}</TableBody>`.
 */
export type TableStateRowProps = { colSpan: number; className?: string } & (
  | { state: "loading"; label?: string }
  | {
      state: "empty";
      title: string;
      description?: string;
      icon?: LucideIcon;
      action?: { label: string; onClick: () => void };
    }
  | { state: "custom"; children: ReactNode }
);

export function TableStateRow(props: TableStateRowProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={props.colSpan} className={cn("h-32 text-center", props.className)}>
        {props.state === "loading" ? (
          <div role="status" aria-busy="true" className="flex items-center justify-center text-muted-foreground">
            <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
            <span className="sr-only">{props.label ?? "Yükleniyor"}</span>
          </div>
        ) : props.state === "empty" ? (
          <EmptyState compact icon={props.icon} title={props.title} description={props.description} action={props.action} />
        ) : (
          props.children
        )}
      </TableCell>
    </TableRow>
  );
}
