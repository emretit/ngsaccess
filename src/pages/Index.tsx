
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Users, Cpu, Key, AlertCircle, ArrowRight, Shield } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import StatusCard from '@/components/StatusCard';
import CardReaderTester from '@/components/CardReaderTester';
import { CardReading } from '@/types/access-control';

export default function Index() {
  const [stats, setStats] = useState({
    employees: 0,
    devices: 0,
    cardReadings: 0,
    pendingRequests: 0,
  });

  const [recentReadings, setRecentReadings] = useState<CardReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get today's date range for filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [
          { data: employees },
          { data: devices },
          { data: cardReadings },
          { data: pendingRequests }
        ] = await Promise.all([
          supabase.from('employees').select('*'),
          supabase.from('devices').select('*').eq('status', 'active'),
          supabase.from('card_readings')
            .select('*')
            .gte('access_time', today.toISOString())
            .lt('access_time', tomorrow.toISOString()),
          supabase.from('access_permissions').select('*').eq('has_access', false)
        ]);

        setStats({
          employees: employees?.length || 0,
          devices: devices?.length || 0,
          cardReadings: cardReadings?.length || 0,
          pendingRequests: pendingRequests?.length || 0,
        });

        // Get last 5 readings instead of 10
        const { data: recent } = await supabase
          .from('card_readings')
          .select('*')
          .order('access_time', { ascending: false })
          .limit(5);

        // Map the data to match the CardReading type
        const mappedReadings: CardReading[] = recent?.map((reading: any) => ({
          ...reading,
          // Ensure status is one of the allowed values
          status: reading.access_granted ? 'success' : 'denied'
        })) || [];
        
        setRecentReadings(mappedReadings);
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
    <div className="space-y-12 p-6">
      {/* Hero Section */}
      <section className="py-8">
        <div className="flex flex-col md:flex-row items-center gap-8 bg-card rounded-lg p-8 shadow-lg">
          <div className="flex-1 space-y-4">
            <h1 className="text-4xl font-bold">
              Hoş Geldiniz, <span className="text-primary">{userName}</span>
            </h1>
            <p className="text-xl text-muted-foreground">
              Güvenli Erişim Kontrol Sistemi yönetim panelinize hoş geldiniz. Tüm erişim kontrol ihtiyaçlarınızı buradan kolayca yönetebilirsiniz.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Button asChild size="lg" className="gap-2">
                <Link to="/access-control">
                  Erişim Kontrolü <ArrowRight size={16} />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/employees">
                  Çalışanlar
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Shield className="h-32 w-32 text-primary opacity-80" />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Sistem Özeti</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatusCard
            title="Toplam Çalışan"
            value={stats.employees.toString()}
            icon={<Users className="h-5 w-5 text-primary" />}
          />
          <StatusCard
            title="Aktif Cihazlar"
            value={stats.devices.toString()}
            icon={<Cpu className="h-5 w-5 text-green-500" />}
          />
          <StatusCard
            title="Bugünkü Geçişler"
            value={stats.cardReadings.toString()}
            icon={<Key className="h-5 w-5 text-yellow-500" />}
          />
          <StatusCard
            title="Bekleyen İstekler"
            value={stats.pendingRequests.toString()}
            icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          />
        </div>
      </section>

      {/* Card Reader Test Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Kart Okuyucu Test Paneli</h2>
        <CardReaderTester />
      </section>

      {/* Recent Card Readings */}
      <section className="bg-card rounded-lg shadow-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">
              Son Kart Okutmaları
            </h2>
            <Button variant="link" asChild className="text-primary">
              <Link to="/access-control">
                Tümünü Görüntüle
              </Link>
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zaman</TableHead>
                  <TableHead>Kişi</TableHead>
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
                ) : recentReadings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Son kart okutma bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  recentReadings.map((reading) => (
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
      </section>

      {/* Quick Links Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-4">Hızlı Erişim</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Cihazlar</CardTitle>
              <CardDescription>Tüm cihazlarınızı yönetin ve durumlarını izleyin</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Okuyucu cihazları, elektronik kilitler ve diğer erişim kontrol donanımlarını buradan yönetin.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/devices">Cihazları Yönetin</Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>PDKS Kayıtları</CardTitle>
              <CardDescription>Çalışan giriş-çıkış kayıtlarını görüntüleyin</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Personel devam kontrol sistemi kayıtlarına buradan erişin ve raporlar oluşturun.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/pdks-records">PDKS Kayıtlarına Git</Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Ayarlar</CardTitle>
              <CardDescription>Sistem ayarlarını ve tercihleri yönetin</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Bildirimler, zaman dilimi, kullanıcı hesapları ve diğer sistem tercihlerini değiştirin.
              </p>
            </CardContent>
            <CardFooter>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/settings">Ayarlara Git</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>
    </div>
  );
};
