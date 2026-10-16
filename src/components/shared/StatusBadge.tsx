import { Badge, type BadgeProps } from "@/components/ui/badge";
import { statusTone, type StatusTone } from "@/lib/statusTone";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps extends Omit<BadgeProps, "variant"> {
  tone: StatusTone;
}

export function StatusBadge({ tone, className, ...props }: StatusBadgeProps) {
  return <Badge variant="outline" className={cn(statusTone(tone), className)} {...props} />;
}
