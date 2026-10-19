import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
}
interface FormFieldWrapperProps {
  htmlFor: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  inline?: boolean;
  children: React.ReactNode | ((props: FieldControlProps) => React.ReactNode);
}

/** Tek kontrol veya render slot'u; DOM sarmalayıcılarına ARIA eklenmez. */
export function FormFieldWrapper({ htmlFor, label, error, hint, className, inline = false, children }: FormFieldWrapperProps) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const control: FieldControlProps = {
    id: htmlFor,
    "aria-invalid": Boolean(error),
    "aria-describedby": [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined,
  };
  const enhance = (nodes: React.ReactNode): React.ReactNode => React.Children.map(nodes, (child) => {
    if (!React.isValidElement<{ id?: string; children?: React.ReactNode; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling" }>(child)) return child;
    if (typeof child.type === "string" && !["input", "select", "textarea", "button"].includes(child.type) || child.type === React.Fragment) {
      return React.cloneElement(child, {}, enhance(child.props.children));
    }
    return React.cloneElement(child, {
      ...control,
      "aria-invalid": control["aria-invalid"] || child.props["aria-invalid"] || false,
      "aria-describedby": [child.props["aria-describedby"], control["aria-describedby"]].filter(Boolean).join(" ") || undefined,
    });
  });
  const renderedControl = typeof children === "function" ? children(control) : enhance(children);
  return <div className={cn("space-y-1.5", className)}>
    {inline ? <Label htmlFor={htmlFor} className="flex min-h-11 cursor-pointer items-center justify-between gap-4">
      <span className="min-w-0 flex-1">{label}</span>
      {renderedControl}
    </Label> : <><Label htmlFor={htmlFor}>{label}</Label>{renderedControl}</>}
    {hint && <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>}
    <FieldError message={error} id={errorId} />
  </div>;
}

export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return <p id={id} className="text-xs text-destructive mt-1" role="alert">{message}</p>;
}
