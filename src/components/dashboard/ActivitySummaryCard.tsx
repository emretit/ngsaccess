import { Activity } from 'lucide-react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivitySummaryCardProps {
  summary: FunctionReturnType<typeof api.dashboard.getActivitySummary> | undefined;
  loading: boolean;
}

export default function ActivitySummaryCard({ summary, loading }: ActivitySummaryCardProps) {
  const rows = summary ? [
    ['Çalışma saatleri', summary.workHours ?? 'Tanımlanmamış'],
    ['Ortalama ilk giriş saati', summary.averageFirstEntry ?? 'Henüz giriş yok'],
    ['Ortalama son çıkış saati', summary.averageLastExit ?? 'Henüz çıkış yok'],
    ['Bugünkü geç kalanlar', `${summary.lateArrivals ?? 0} kişi`],
    ['Bugün mevcut personel', `${summary.presentToday ?? 0} kişi`],
  ] : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Activity className="h-5 w-5 mr-2" /> Aktivite Özeti · Bugün
        </CardTitle>
        <p className="text-xs text-muted-foreground">İstanbul saati · İzin verilen personel okumaları</p>
      </CardHeader>
      <CardContent>
        {loading || !summary ? (
          <div className="space-y-4" role="status" aria-label="Aktivite özeti yükleniyor">
            {[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-6 w-full" />)}
          </div>
        ) : summary.presentToday === null ? (
          <EmptyState title="Bugün henüz okuma yok" className="py-6" />
        ) : (
          <div className="space-y-4">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between items-center gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium text-right">{value}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
