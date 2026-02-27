import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessDeniedProps {
  message?: string;
  className?: string;
}

export function AccessDenied({
  message = "Bu sayfaya erişim için size atanmış bir proje bulunmuyor. Lütfen sistem yöneticinizle iletişime geçin.",
  className,
}: AccessDeniedProps) {
  return (
    <div
      className={cn(
        "flex min-h-[400px] items-center justify-center",
        className
      )}
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <Lock className="h-8 w-8 text-amber-600 dark:text-amber-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Proje Erişimi Yok
          </h3>
          <p className="mt-2 text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}
