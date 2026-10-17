
import React from 'react';
import { Users, Cpu, Key, AlertCircle } from 'lucide-react';
import { StatCard } from '@/components/shared/StatCard';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { Skeleton } from '@/components/ui/skeleton';

interface StatsGridProps {
  stats: FunctionReturnType<typeof api.dashboard.getStats> | undefined;
  loading: boolean;
}

const StatsGrid: React.FC<StatsGridProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" role="status" aria-label="Proje istatistikleri yükleniyor">
        {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-28 rounded-lg" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        label="Toplam Personel"
        value={stats.employees.toString()}
        Icon={Users}
      />
      <StatCard
        label="Aktif Cihazlar"
        value={stats.devices.toString()}
        Icon={Cpu} tone="success"
      />
      <StatCard
        label="Bugünkü Geçişler"
        value={stats.cardReadings.toString()}
        Icon={Key} tone="warning"
      />
      <StatCard
        label="Pasif erişim kuralları"
        value={stats.pendingRequests.toString()}
        Icon={AlertCircle} tone="danger"
      />
    </div>
  );
};

export default StatsGrid;
