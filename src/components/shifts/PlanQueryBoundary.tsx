import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { shiftError } from './lib/shiftError';
import { shiftMessage } from './lib/planning';

/** Preview errors must expose the server's validation message while preserving the draft. */
export class PlanQueryBoundary extends Component<{ resetKey: string; children: ReactNode }, { error: unknown; attempt: number }> {
  state: { error: unknown; attempt: number } = { error: null, attempt: 0 };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  componentDidUpdate(previous: { resetKey: string }) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) return <div className="space-y-2"><p role="alert" className="text-sm text-danger">{shiftMessage(shiftError(this.state.error).message)}</p><Button variant="outline" onClick={() => this.setState(state => ({ error: null, attempt: state.attempt + 1 }))}>Yeniden dene</Button></div>;
    return <section key={this.state.attempt}>{this.props.children}</section>;
  }
}
