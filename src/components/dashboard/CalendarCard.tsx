
import React from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const CalendarCard: React.FC = () => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center">
          <Calendar className="h-5 w-5 mr-2" /> Takvim
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Bugün</span>
            <span className="font-medium">{format(new Date(), "d MMMM yyyy, EEEE", { locale: tr })}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">İzinli personel</span>
            <Badge>5 kişi</Badge>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Toplantılar</span>
            <span className="font-medium">3 toplantı</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Özel günler</span>
            <Badge variant="outline">Yok</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CalendarCard;
