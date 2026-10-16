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
      fallback={() => (
        <ErrorState
          title={`${label} yüklenemedi`}
          description="Veriler alınırken bir hata oluştu. Filtreleri veya proje seçimini kontrol edin."
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
