import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Ana sayfa bölümü: tablo kartıyla aynı kenarlık, başlık şeridinde ad + kısa bağlam + sağda bağlantı. */
export function DashboardPanel({
  title,
  context,
  aside,
  link,
  className,
  children,
}: {
  title: string;
  /** Başlığın yanında soluk metin, ör. "Bugün, saatlik". */
  context?: ReactNode;
  /** Başlık şeridinin sağı (gösterge, sayaç). */
  aside?: ReactNode;
  link?: { to: string; label: string };
  className?: string;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-surface", className)}>
      <header className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-2 min-[761px]:px-5">
        <h2 id={headingId} className="text-sm font-semibold">{title}</h2>
        {context && <span className="text-xs text-muted-foreground">{context}</span>}
        <div className="ml-auto flex items-center gap-3 text-xs">
          {aside}
          {link && (
            <Link to={link.to} className="inline-flex min-h-8 items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
              {link.label}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </header>
      {children}
    </section>
  );
}
