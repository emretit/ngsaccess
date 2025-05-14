import { useDashboard } from '@/hooks/useDashboard';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatsGrid from '@/components/dashboard/StatsGrid';
import ActivitySummaryCard from '@/components/dashboard/ActivitySummaryCard';
import CalendarCard from '@/components/dashboard/CalendarCard';
import RecentReadingsTable from '@/components/dashboard/RecentReadingsTable';
import QuickLinksGrid from '@/components/dashboard/QuickLinksGrid';

export default function Index() {
  const {
    stats,
    recentReadings,
    loading,
    userName,
    session,
    refreshData
  } = useDashboard();

  // If not authenticated yet (loading state), show a simple loading screen
  if (!session && loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Yükleniyor...</h2>
          <p className="text-muted-foreground">Lütfen bekleyin, dashboard hazırlanıyor.</p>
        </div>
      </div>
    );
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
