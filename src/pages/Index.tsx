import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Users, Cpu, Key, AlertCircle, Activity, Clock, Calendar, RefreshCw } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import StatusCard from '@/components/StatusCard';
import CardReaderTester from '@/components/CardReaderTester';
import { CardReading } from '@/types/access-control';
import { toast } from '@/hooks/use-toast';

export default function Index() {
  const [stats, setStats] = useState({
    employees: 0,
    devices: 0,
    cardReadings: 0,
    pendingRequests: 0,
  });

  const [recentReadings, setRecentReadings] = useState<CardReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Kullanıcı");
  const [session, setSession] = useState<any>(null);
  const navigate = useNavigate();

  // Check authentication status
  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        navigate('/login');
        return;
      }
      
      if (!data.session) {
        // Not logged in, redirect to login
        navigate('/login');
        return;
      }
      
      setSession(data.session);
      
      // Get user email if available and use it for display
      if (data.session?.user) {
        // Extract username from email (part before @)
        const email = data.session.user.email;
        const displayName = email ? email.split('@')[0] : "Kullanıcı";
        setUserName(displayName);
      }
    };
    
    checkSession();
    
    // Setup auth state change listener
    const { data: { subscription }} = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        navigate('/login');
      }
      setSession(session);
    });
    
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch dashboard data
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

        // Get last 5 readings
        const { data: recent } = await supabase
          .from('card_readings')
          .select('*')
          .order('access_time', { ascending: false })
          .limit(5);

        // Map the data to match the CardReading type
        const mappedReadings: CardReading[] = recent?.map((reading: any) => ({
          ...reading,
          status: reading.access_granted ? 'success' : 'denied'
        })) || [];
        
        setRecentReadings(mappedReadings);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Veri yükleme hatası",
          description: "Dashboard verisi yüklenirken bir hata oluştu.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    if (session) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const refreshData = () => {
    setLoading(true);
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

        // Get last 5 readings
        const { data: recent } = await supabase
          .from('card_readings')
          .select('*')
          .order('access_time', { ascending: false })
          .limit(5);

        // Map the data to match the CardReading type
        const mappedReadings: CardReading[] = recent?.map((reading: any) => ({
          ...reading,
          status: reading.access_granted ? 'success' : 'denied'
        })) || [];
        
        setRecentReadings(mappedReadings);
        
        toast({
          title: "Veriler güncellendi",
          description: "Dashboard verileri başarıyla güncellendi.",
          variant: "default"
        });
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: "Veri yükleme hatası",
          description: "Dashboard verisi yüklenirken bir hata oluştu.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  };

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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">
          Hoş geldin, {userName}
        </h1>
        <Button 
          variant="outline" 
          onClick={refreshData} 
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Yükleniyor...' : 'Verileri Yenile'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Toplam Personel"
          value={stats.employees.toString()}
          icon={<Users className="h-4 w-4 text-primary" />}
        />
        <StatusCard
          title="Aktif Cihazlar"
          value={stats.devices.toString()}
          icon={<Cpu className="h-4 w-4 text-green-500" />}
        />
        <StatusCard
          title="Bugünkü Geçişler"
          value={stats.cardReadings.toString()}
          icon={<Key className="h-4 w-4 text-yellow-500" />}
        />
        <StatusCard
          title="Bekleyen İstekler"
          value={stats.pendingRequests.toString()}
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Summary */}
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

        {/* Schedule Information */}
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
      </div>

      {/* Add the Card Reader Test Panel */}
      <CardReaderTester />

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
                ) : recentReadings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Henüz kart okutma kaydı yok
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/employees" className="group">
          <Card className="transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center text-muted-foreground group-hover:text-primary">
                <Users className="h-5 w-5 mr-2" /> Personel Yönetimi
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Personel bilgilerini görüntüle, düzenle ve yeni personel ekle.
              </p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/pdks-records" className="group">
          <Card className="transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center text-muted-foreground group-hover:text-primary">
                <Clock className="h-5 w-5 mr-2" /> PDKS Kayıtları
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Personel giriş çıkış kayıtlarını görüntüle ve raporla.
              </p>
            </CardContent>
          </Card>
        </Link>
        
        <Link to="/settings" className="group">
          <Card className="transition-all duration-300 group-hover:border-primary group-hover:shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center text-muted-foreground group-hover:text-primary">
                <AlertCircle className="h-5 w-5 mr-2" /> Ayarlar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Sistem ayarlarını yapılandır ve kuralları düzenle.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
};
