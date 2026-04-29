
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
  const getStatusBadge = (reading: CardReading) => {
    // Use accessStatus for badge determination
    const hasAccess = reading.accessStatus === 'izin_verildi';

    return (
      <Badge variant={hasAccess ? 'success' : 'destructive'}>
        {hasAccess ? 'İzin Verildi' : 'Reddedildi'}
      </Badge>
    );
  };

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
                readings.map((reading) => {
                  const timeValue = reading.accessTime;
                  const date = timeValue ? new Date(timeValue) : null;
                  const isValidDate = date && !Number.isNaN(date.getTime());
                  return (
                  <TableRow key={reading._id}>
                    <TableCell>
                      {isValidDate ? format(date, 'HH:mm', { locale: tr }) : '-'}
                    </TableCell>
                    <TableCell>{reading.employeeName}</TableCell>
                    <TableCell>{reading.devices?.name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(reading)}</TableCell>
                  </TableRow>
                );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default RecentReadingsTable;
