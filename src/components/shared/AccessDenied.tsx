import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessDeniedProps {
  message?: string;
  className?: string;
  compact?: boolean;
}

export function AccessDenied({
  message = "Bu sayfaya erişim için size atanmış bir proje bulunmuyor. Lütfen sistem yöneticinizle iletişime geçin.",
  className,
  compact = false,
}: AccessDeniedProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex min-h-[400px] items-center justify-center",
        compact && "min-h-0 py-6",
        className
      )}
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-8 w-8 items-center justify-center ">
          <Lock className="h-5 w-5 text-[hsl(var(--warning))]" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Proje erişimi yok
          </h3>
          <p className="mt-2 text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
