
import React from 'react';
import { Users, Cpu, Key, AlertCircle } from 'lucide-react';
import StatusCard from '@/components/StatusCard';
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
      <StatusCard
        title="Toplam Personel"
        value={stats.employees.toString()}
        icon={<Users className="h-4 w-4 text-primary" />}
      />
      <StatusCard
        title="Aktif Cihazlar"
        value={stats.devices.toString()}
        icon={<Cpu className="h-4 w-4 text-[hsl(var(--success))]" />}
      />
      <StatusCard
        title="Bugünkü Geçişler"
        value={stats.cardReadings.toString()}
        icon={<Key className="h-4 w-4 text-[hsl(var(--warning))]" />}
      />
      <StatusCard
        title="Pasif erişim kuralları"
        value={stats.pendingRequests.toString()}
        icon={<AlertCircle className="h-4 w-4 text-destructive" />}
      />
    </div>
  );
};

export default StatsGrid;
