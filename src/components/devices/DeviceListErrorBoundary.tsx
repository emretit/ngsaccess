import { Component, type ReactNode } from 'react';
import { PageTemplate } from '@/components/shared/PageTemplate';
import { ErrorState } from '@/components/shared/ErrorState';

export class DeviceListErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <PageTemplate title="Cihazlar"><ErrorState title="Cihazlar yüklenemedi" description="Bağlantınızı kontrol edip yeniden deneyin." onRetry={() => this.setState({ failed: false })} /></PageTemplate>
      : this.props.children;
  }
}
