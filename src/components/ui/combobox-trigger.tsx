import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

/** Combobox popup'ı: tetikleyici genişliğinde, dar alanlarda arama için en az 240px, ekrana sığar. */
export const COMBOBOX_CONTENT_CLASS =
  "w-(--radix-popover-trigger-width) min-w-[min(240px,calc(100vw-32px))] max-w-[calc(100vw-32px)] p-0"

interface ComboboxTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Seçim yokken metni placeholder rengiyle göster (SelectTrigger ile aynı). */
  placeholder?: boolean
  /** Uzun seçimi kırpmak yerine alt satıra kaydır. */
  wrap?: boolean
}

/** Popover + Command seçicileri için SelectTrigger görünümlü tetikleyici (PopoverTrigger asChild ile). */
const ComboboxTrigger = React.forwardRef<HTMLButtonElement, ComboboxTriggerProps>(
  ({ className, children, placeholder, wrap, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      role="combobox"
      data-placeholder={placeholder ? "" : undefined}
      className={cn(
        "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-surface px-3 py-2 text-left text-base font-normal md:text-sm ring-offset-background data-placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50",
        wrap && "h-auto min-h-9",
        className
      )}
      {...props}
    >
      <span className={cn("min-w-0 flex-1", wrap ? "break-words" : "truncate")}>{children}</span>
      <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
    </button>
  )
)
ComboboxTrigger.displayName = "ComboboxTrigger"

export { ComboboxTrigger }
