import { Component, type ReactNode } from 'react';
import { ErrorState } from '@/components/shared/ErrorState';

export class DeviceListErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <ErrorState title="Cihazlar yüklenemedi" description="Bağlantınızı kontrol edip yeniden deneyin." onRetry={() => window.location.reload()} />
      : this.props.children;
  }
}
