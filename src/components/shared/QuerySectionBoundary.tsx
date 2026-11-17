import { Component, type ReactElement, type ReactNode } from "react";
import { ErrorState } from "./ErrorState";

export interface QuerySectionBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
  onRetry?: () => void;
  renderFallback?: (retry: () => void) => ReactElement;
  resetKey?: string | number;
  className?: string;
}

/** Sorguyu çağıran bileşeni boundary'nin çocuğu olarak render edin. */
export class QuerySectionBoundary extends Component<QuerySectionBoundaryProps, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidUpdate(previous: QuerySectionBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  private retry = () => {
    this.props.onRetry?.();
    this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }));
  };
  render() {
    if (this.state.failed && this.props.renderFallback) return this.props.renderFallback(this.retry);
    if (this.state.failed) return <ErrorState title={this.props.title} description={this.props.description}
      className={this.props.className} compact onRetry={this.retry} />;
    return <section key={this.state.attempt} className={this.props.className}>{this.props.children}</section>;
  }
}
