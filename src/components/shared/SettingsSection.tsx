import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SettingsSectionProps {
  id?: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  divided?: boolean;
  density?: "compact" | "regular";
}

export function SettingsSection({
  id,
  title,
  description,
  children,
  actions,
  divided = false,
  density = "regular",
}: SettingsSectionProps) {
  const generatedId = useId();
  const titleId = `${id ?? generatedId}-title`;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        density === "compact" || divided ? "space-y-3" : "space-y-4",
        divided && (density === "compact" ? "border-t pt-4" : "border-t pt-5"),
      )}
    >
      <div>
        <h3
          id={titleId}
          className={cn(
            "font-semibold",
            density === "compact" ? "text-sm" : "text-base",
          )}
        >
          {title}
        </h3>
        {description != null && (
          <div className="mt-1 text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {children}
      {actions}
    </section>
  );
}
