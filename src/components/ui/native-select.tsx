import * as React from "react"

import { cn } from "@/lib/utils"

/** Ham `<select>` için SelectTrigger ile aynı border, yüzey, focus ring ve hata görünümü. */
export const nativeSelectClass =
  "h-9 w-full rounded-md border border-input bg-surface px-3 py-1 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive disabled:cursor-not-allowed disabled:opacity-50"

const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, ...props }, ref) => (
    <select ref={ref} className={cn(nativeSelectClass, className)} {...props} />
  )
)
NativeSelect.displayName = "NativeSelect"

export { NativeSelect }
