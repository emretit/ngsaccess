import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SectionSkeletonProps {
  rows?: number;
  label?: string;
  className?: string;
}

export function SectionSkeleton({ rows = 3, label = "Yükleniyor", className }: SectionSkeletonProps) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className={cn("space-y-3", className)}>
      {Array.from({ length: rows }, (_, index) => <Skeleton key={index} aria-hidden="true" className="h-[42px] w-full" />)}
    </div>
  );
}
