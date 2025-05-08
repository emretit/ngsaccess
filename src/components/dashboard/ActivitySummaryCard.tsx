
import React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const ActivitySummaryCard: React.FC = () => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Activity className="h-5 w-5 mr-2" /> Aktivite Özeti
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Çalışma saatleri</span>
            <span className="font-medium">08:00 - 18:00</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Ortalama geliş saati</span>
            <span className="font-medium">08:32</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Ortalama çıkış saati</span>
            <span className="font-medium">17:45</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Bugünkü geç kalanlar</span>
            <Badge variant="warning">3 kişi</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivitySummaryCard;
