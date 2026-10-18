import { Component, type ReactNode } from "react";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { errorMessage } from "@/lib/notify";
class ScopeBoundary extends Component<
  { children: ReactNode },
  { error: unknown }
> {
  state: { error: unknown } = { error: undefined };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    if (this.state.error) {
      if (errorMessage(this.state.error).includes("erişim yetkiniz yok"))
        return (
          <EmptyState
            title="Bu projedeki izinleri görüntüleme yetkiniz yok."
            description="Üst çubuktan erişebildiğiniz bir proje seçin."
          />
        );
      throw this.state.error;
    }
    return this.props.children;
  }
}
export function LeaveQueryBoundary({
  children,
  scope,
}: {
  children: ReactNode;
  scope: string;
}) {
  return (
    <QuerySectionBoundary
      resetKey={scope}
      title="İzin kayıtları yüklenemedi."
      description="Tekrar deneyin. Filtreleriniz korunur."
    >
      <ScopeBoundary key={scope}>{children}</ScopeBoundary>
    </QuerySectionBoundary>
  );
}
