import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md w-full rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Bir hata oluştu</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Sayfa yüklenirken beklenmeyen bir sorun oluştu. Lütfen yeniden deneyin.
          </p>
          {import.meta.env.DEV && (
            <pre className="mb-4 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {error.message}
            </pre>
          )}
          <div className="flex gap-2">
            <Button onClick={this.reset} variant="default" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tekrar Dene
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline" size="sm">
              Sayfayı Yenile
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
