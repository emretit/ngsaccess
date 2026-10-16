
import React from 'react';
import { Link } from 'react-router-dom';
import type { FunctionReturnType } from 'convex/server';
import { api } from '../../../convex/_generated/api';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionSkeleton } from '@/components/shared/SectionSkeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/StatusBadge';
type RecentReadings = FunctionReturnType<typeof api.dashboard.getRecentReadings>;

const trDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' });
const trTime = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' });
const trDate = new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short' });

function formatReadingTime(date: Date) {
  const day = trDay.format(date) === trDay.format(new Date()) ? 'Bugün' : trDate.format(date);
  return `${day} ${trTime.format(date)}`;
}

interface RecentReadingsTableProps {
  readings: RecentReadings;
  loading: boolean;
}

const RecentReadingsTable: React.FC<RecentReadingsTableProps> = ({ readings, loading }) => {
  const getStatusBadge = (reading: RecentReadings[number]) => {
    // Use accessStatus for badge determination
    const hasAccess = reading.accessStatus === 'izin_verildi';

    return (
      <StatusBadge tone={hasAccess ? 'success' : 'danger'}>
        {hasAccess ? 'İzin Verildi' : 'Reddedildi'}
      </StatusBadge>
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
                <TableHead>Tarih / Saat</TableHead>
                <TableHead>Personel</TableHead>
                <TableHead>Cihaz</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4">
                    <SectionSkeleton rows={3} label="Son okumalar yükleniyor" />
                  </TableCell>
                </TableRow>
              ) : readings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                    <EmptyState title="Henüz kart okutma kaydı yok" description="Personel ve cihaz kurulumunu kontrol etmek için aşağıdaki hızlı erişim bağlantılarını kullanabilirsiniz." className="py-6" />
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
                      {isValidDate ? formatReadingTime(date) : '-'}
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
