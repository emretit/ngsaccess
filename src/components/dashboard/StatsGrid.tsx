
import React from 'react';
import { Users, Cpu, Key, AlertCircle } from 'lucide-react';
import StatusCard from '@/components/StatusCard';
import { DashboardStats } from '@/utils/dashboardUtils';

interface StatsGridProps {
  stats: DashboardStats;
}

const StatsGrid: React.FC<StatsGridProps> = ({ stats }) => {
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
        icon={<Cpu className="h-4 w-4 text-green-500" />}
      />
      <StatusCard
        title="Bugünkü Geçişler"
        value={stats.cardReadings.toString()}
        icon={<Key className="h-4 w-4 text-yellow-500" />}
      />
      <StatusCard
        title="Bekleyen İstekler"
        value={stats.pendingRequests.toString()}
        icon={<AlertCircle className="h-4 w-4 text-red-500" />}
      />
    </div>
  );
};

export default StatsGrid;
