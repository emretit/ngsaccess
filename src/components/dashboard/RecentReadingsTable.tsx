
import React from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CardReading } from '@/types/access-control';

interface RecentReadingsTableProps {
  readings: CardReading[];
  loading: boolean;
}

const RecentReadingsTable: React.FC<RecentReadingsTableProps> = ({ readings, loading }) => {
  return (
    <div className="bg-card rounded-lg shadow-md">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Son Kart Okutmaları
          </h2>
          <Link 
            to="/access-control" 
            className="text-primary hover:text-primary/80 text-sm"
          >
            Tümünü Görüntüle
          </Link>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Saat</TableHead>
                <TableHead>Personel</TableHead>
                <TableHead>Cihaz</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    Yükleniyor...
                  </TableCell>
                </TableRow>
              ) : readings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    Henüz kart okutma kaydı yok
                  </TableCell>
                </TableRow>
              ) : (
                readings.map((reading) => (
                  <TableRow key={reading.id}>
                    <TableCell>
                      {format(new Date(reading.access_time), 'HH:mm', { locale: tr })}
                    </TableCell>
                    <TableCell>{reading.employee_name}</TableCell>
                    <TableCell>{reading.device_name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={reading.status === 'success' ? 'success' : 'destructive'}>
                        {reading.status === 'success' ? 'İzin Verildi' : 'Reddedildi'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default RecentReadingsTable;
