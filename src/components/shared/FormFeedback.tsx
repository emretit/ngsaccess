import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FormFeedbackProps = {
  tone: "error" | "info";
  title?: string;
  children: ReactNode;
  id?: string;
  variant?: "inline" | "panel";
  action?: ReactNode;
};

export function FormFeedback({ tone, title, children, id, variant = "inline", action }: FormFeedbackProps) {
  return <div id={id} role={tone === "error" ? "alert" : "status"} className={cn(
    "text-sm break-words",
    tone === "error" ? "text-destructive" : "text-muted-foreground",
    variant === "panel" && "rounded-md border p-3",
    variant === "panel" && tone === "error" && "border-destructive",
  )}>
    {title && <p className="font-medium">{title}</p>}
    {children}
    {action}
  </div>;
}
