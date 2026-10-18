import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorState } from "@/components/shared/ErrorState";

export function AdminDataBoundary({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <ErrorBoundary
      fallback={(_error, reset) => (
        <ErrorState
          title={`${label} yüklenemedi`}
          description="Tekrar deneyin; diğer yönetim bölümlerini kullanabilirsiniz."
          onRetry={reset}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
