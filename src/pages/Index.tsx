import { useDashboard } from '@/hooks/useDashboard';
import DashboardHeader from '@/components/dashboard/DashboardHeader';
import StatsGrid from '@/components/dashboard/StatsGrid';
import ActivitySummaryCard from '@/components/dashboard/ActivitySummaryCard';
import RecentReadingsTable from '@/components/dashboard/RecentReadingsTable';
import QuickLinksGrid from '@/components/dashboard/QuickLinksGrid';
import { EmptyState } from '@/components/shared/EmptyState';

export default function Index() {
  const dashboard = useDashboard();
  return (
    <div className="space-y-8 p-6">
      <DashboardHeader userName={dashboard.userName} projectName={dashboard.projectName} />
      {dashboard.noProject ? (
        <EmptyState title="Erişilebilir proje bulunamadı" description="Proje erişimi için yöneticinizle iletişime geçin." />
      ) : (
        <>
          <StatsGrid stats={dashboard.stats} loading={dashboard.statsLoading} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ActivitySummaryCard summary={dashboard.activitySummary} loading={dashboard.activityLoading} />
          </div>
          <RecentReadingsTable readings={dashboard.recentReadings} loading={dashboard.readingsLoading} />
          <QuickLinksGrid />
        </>
      )}
    </div>
  );
}
