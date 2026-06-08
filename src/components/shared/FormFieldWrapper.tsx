import React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldWrapperProps {
  htmlFor: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + input slot + inline hata mesajı sarmalayıcısı.
 * `error` verildiğinde tek child element'e otomatik olarak
 * `aria-invalid` ve `aria-describedby` enjekte eder.
 */
export function FormFieldWrapper({
  htmlFor,
  label,
  error,
  className,
  children,
}: FormFieldWrapperProps) {
  const errorId = error ? `${htmlFor}-error` : undefined;

  const enhancedChildren = error
    ? React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              "aria-invalid": true,
              "aria-describedby": errorId,
            } as object)
          : child
      )
    : children;

  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {enhancedChildren}
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  );
}

/** Bağımsız satır içi hata metni. `id` verilirse input'un aria-describedby'ı bu id'ye point etmeli. */
export function FieldError({ message, id }: { message?: string; id?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive mt-1" role="alert" aria-live="polite">
      {message}
    </p>
  );
}
