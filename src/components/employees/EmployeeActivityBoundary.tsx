import { Component, type ReactNode } from "react";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { ConvexError } from "convex/values";
/** Activity queries distinguish authorization failures from unavailable data. */
export class EmployeeActivityBoundary extends Component<
  { children: ReactNode; employeeId: string; projectId?: string; title: string; description: string },
  { error: unknown; attempt: number }
> {
  state: { error: unknown; attempt: number } = { error: null, attempt: 0 };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  componentDidUpdate(previous: { employeeId: string; projectId?: string }) {
    if ((previous.employeeId !== this.props.employeeId || previous.projectId !== this.props.projectId) && this.state.error)
      this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      const error = this.state.error;
      if (
        error instanceof ConvexError &&
        typeof error.data === "string" &&
        error.data === "Bu personele erişim yetkiniz yok"
      )
        return (
          <AccessDenied
            compact
            message="Bu personelin etkinlik kayıtlarını görüntüleme yetkiniz yok."
          />
        );
      return (
        <section className="space-y-3 border-t pt-5">
          <h3 className="text-base font-semibold">{this.props.title}</h3>
          <ErrorState compact description={this.props.description} />
          <div className="flex justify-center">
            <Button className="max-sm:min-h-11"
              variant="outline"
              size="sm"
              onClick={() =>
                this.setState(({ attempt }) => ({
                  error: null,
                  attempt: attempt + 1,
                }))
              }
            >
              Yeniden dene
            </Button>
          </div>
        </section>
      );
    }
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
