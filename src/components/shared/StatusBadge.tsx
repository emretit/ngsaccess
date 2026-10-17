import { Badge, type BadgeProps } from "@/components/ui/badge";
import { statusTone, type StatusTone } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  tone: StatusTone;
}

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return <Badge variant="outline" className={cn("gap-1.5 border-transparent before:h-1 before:w-1 before:shrink-0 before:rounded-full before:bg-current", statusTone(tone), className)} {...props} />;
}
