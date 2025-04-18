
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Users, Cpu, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import StatusCard from '@/components/StatusCard';

interface CardReading {
  id: number;
  card_no: string;
  status: string;
  access_time: string;
  employee_name: string;
  device_name: string | null;
  device_location: string | null;
}

export default function Index() {
  const [stats, setStats] = useState({
    employees: 0,
    devices: 0,
    cardReadings: 0,
  });

  const [recentReadings, setRecentReadings] = useState<CardReading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          { data: employees },
          { data: devices },
          { data: cardReadings }
        ] = await Promise.all([
          supabase.from('employees').select('*'),
          supabase.from('devices').select('*'),
          supabase.from('card_readings').select('*')
        ]);

        setStats({
          employees: employees?.length || 0,
          devices: devices?.length || 0,
          cardReadings: cardReadings?.length || 0,
        });

        // Get last 10 readings
        const recent = cardReadings
          ?.sort((a, b) => new Date(b.access_time).getTime() - new Date(a.access_time).getTime())
          ?.slice(0, 10) || [];

        setRecentReadings(recent);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8 p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Ana Sayfa</h1>
        <Link to="/access-control" className="text-primary hover:text-primary/80">
          Tüm Logları Görüntüle
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard
          title="Toplam Personel"
          value={stats.employees.toString()}
          icon={<Users className="h-4 w-4 text-blue-500" />}
        />
        <StatusCard
          title="Toplam Cihaz"
          value={stats.devices.toString()}
          icon={<Cpu className="h-4 w-4 text-green-500" />}
        />
        <StatusCard
          title="Kart Okuma"
          value={stats.cardReadings.toString()}
          icon={<Key className="h-4 w-4 text-yellow-500" />}
        />
      </div>

      <div className="bg-card rounded-lg shadow">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Son Geçişler
          </h2>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih/Saat</TableHead>
                  <TableHead>Çalışan</TableHead>
                  <TableHead>Kart No</TableHead>
                  <TableHead>Cihaz</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : recentReadings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">
                      Henüz geçiş kaydı bulunmuyor
                    </TableCell>
                  </TableRow>
                ) : (
                  recentReadings.map((reading) => (
                    <TableRow key={reading.id}>
                      <TableCell>
                        {format(new Date(reading.access_time), 'dd.MM.yyyy HH:mm:ss', { locale: tr })}
                      </TableCell>
                      <TableCell>{reading.employee_name}</TableCell>
                      <TableCell>{reading.card_no}</TableCell>
                      <TableCell>{reading.device_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={reading.status === 'success' ? 'success' : 'destructive'}>
                          {reading.status === 'success' ? 'Başarılı' : 'Başarısız'}
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
    </div>
  );
}
