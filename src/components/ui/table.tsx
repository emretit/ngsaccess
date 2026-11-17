import * as React from "react"

import { cn } from "@/lib/utils"
import {
  COLUMN_SCALE_VAR,
  columnWidth,
  ColumnResizeHandle,
  ColumnResizeProvider,
  useColumnResize,
  useColumnResizeState,
} from "./table-resize"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement> & {
    density?: "compact" | "comfortable"
    /** Verilirse `columnId`'li başlıklar sürüklenebilir olur; genişlik bu anahtarla saklanır. */
    resizeKey?: string
    /** Kenarlıklı kutu; tablonun dışına ayrıca kaydırma/kenarlık div'i sarmayın. */
    framed?: boolean
    /** Verilirse kaydırma kutusu klavyeyle odaklanıp kaydırılabilen adlandırılmış bölge olur. */
    scrollLabel?: string
  }
>(({ className, density = "compact", resizeKey, framed = false, scrollLabel, style, ...props }, ref) => {
  const resize = useColumnResizeState(resizeKey)
  const setRef = React.useCallback(
    (el: HTMLTableElement | null) => {
      resize.tableRef.current = el
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    },
    [ref, resize.tableRef]
  )
  return (
    <ColumnResizeProvider value={resize.context}>
      <div
        role={scrollLabel ? "region" : undefined}
        aria-label={scrollLabel}
        tabIndex={scrollLabel ? 0 : undefined}
        className={cn(
          "relative w-full overflow-auto",
          framed && "rounded-md border",
          scrollLabel && "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        )}
      >
        <table
          ref={setRef}
          className={cn(
            "w-full caption-bottom text-xs",
            `table-density-${density}`,
            className,
            resize.frozen && "[&_td]:[overflow-clip-margin:4px] [&_td]:[overflow:clip]"
          )}
          style={resize.frozen ? { ...style, tableLayout: "fixed" } : style}
          {...props}
        />
      </div>
    </ColumnResizeProvider>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-selected",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    /** `resizeKey`'li tabloda sütunun kalıcı kimliği; verilmezse sütun dondurulmaz. */
    columnId?: string
    /** `false`: genişlik dondurulur ama tutamak gösterilmez (onay kutusu, işlem sütunu). */
    resizable?: boolean
    /** Tutamağın erişilebilir adı; metin olmayan başlıklarda verin. */
    resizeLabel?: string
    minWidth?: number
  }
>(({ className, columnId, resizable = true, resizeLabel, minWidth, style, children, ...props }, ref) => {
  const resize = useColumnResize()
  const active = resize !== null && columnId !== undefined
  const { register } = resize ?? {}
  const setRef = React.useCallback(
    (el: HTMLTableCellElement | null) => {
      if (register && columnId !== undefined) register(columnId, el)
      if (typeof ref === "function") ref(el)
      else if (ref) ref.current = el
    },
    [ref, register, columnId]
  )
  const base = active && resize.frozen ? columnWidth(resize.widths[columnId], minWidth) : undefined
  // Sürüklenebilir sütun kabı doldurmak için ölçeklenir; sabit sütun (onay kutusu, işlem) tabanda kalır.
  const width = base === undefined || !resizable ? base : `calc(${base}px * var(${COLUMN_SCALE_VAR}, 1))`
  return (
    <th
      ref={setRef}
      data-column-id={active ? columnId : undefined}
      data-column-fixed={active && !resizable ? "" : undefined}
      data-column-min-width={active ? minWidth : undefined}
      className={cn(
        "h-9 bg-subtle px-4 text-[11px] text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
        // className'den sonra gelmemeli: sticky/absolute başlıkları ezmesin.
        active && "relative",
        className,
        active && resize.frozen && "overflow-hidden text-ellipsis whitespace-nowrap"
      )}
      style={{ ...style, ...(minWidth === undefined ? {} : { minWidth }), ...(width === undefined ? {} : { width }) }}
      {...props}
    >
      {children}
      {active && resizable && (
        <ColumnResizeHandle
          columnId={columnId}
          label={resizeLabel ?? (typeof children === "string" ? children : undefined)}
          minWidth={minWidth}
        />
      )}
    </th>
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("h-[42px] px-4 py-2 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
