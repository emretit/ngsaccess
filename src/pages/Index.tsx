
import { useDashboard } from '@/hooks/useDashboard';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatsGrid from '@/components/dashboard/StatsGrid';
import ActivitySummaryCard from '@/components/dashboard/ActivitySummaryCard';
import RecentReadingsTable from '@/components/dashboard/RecentReadingsTable';
import QuickLinksGrid from '@/components/dashboard/QuickLinksGrid';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Index() {
  const {
    stats,
    recentReadings,
    statsLoading,
    readingsLoading,
    userName,
    session,
    refetchStats,
    refetchReadings
  } = useDashboard();

  const loading = statsLoading || readingsLoading;
  const refreshData = () => { refetchStats(); refetchReadings(); };

  // If not authenticated yet (loading state), show a simple loading screen
  if (!session && loading) {
    return <LoadingSpinner text="Dashboard hazırlanıyor..." />;
  }

  return (
    <div className="space-y-8 p-6">
      <DashboardHeader 
        userName={userName} 
        loading={loading} 
        onRefresh={refreshData} 
      />

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivitySummaryCard />
      </div>

      <RecentReadingsTable 
        readings={recentReadings} 
        loading={loading} 
      />

      <QuickLinksGrid />
    </div>
  );
}
