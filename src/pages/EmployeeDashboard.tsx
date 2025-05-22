
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  fetchEmployeeRecords, 
  employeeLogout, 
  getCurrentEmployeeUser,
  isEmployeeAuthenticated
} from '@/services/employeeAuthService';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, Clock, Calendar, User, CalendarCheck } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface PDKSRecord {
  id: number;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
  employee_first_name: string;
  employee_last_name: string;
}

export default function EmployeeDashboard() {
  const [records, setRecords] = useState<PDKSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const user = getCurrentEmployeeUser();

  useEffect(() => {
    // Check if user is authenticated
    if (!isEmployeeAuthenticated()) {
      navigate('/employee-login');
      return;
    }

    const loadRecords = async () => {
      setLoading(true);
      try {
        const { records, error } = await fetchEmployeeRecords();
        
        if (error) {
          setError(error);
          return;
        }
        
        setRecords(records || []);
      } catch (err) {
        setError('Kayıtlar yüklenirken bir hata oluştu.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [navigate]);

  const handleLogout = () => {
    employeeLogout();
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '-';
    return timeStr;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="success">Tam Gün</Badge>;
      case 'late':
        return <Badge variant="warning">Geç Geldi</Badge>;
      case 'absent':
        return <Badge variant="destructive">Gelmedi</Badge>;
      case 'early_leave':
        return <Badge variant="warning">Erken Çıktı</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
            P
          </div>
          <p className="text-lg font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#711A1A] text-white py-4">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white text-[#711A1A] rounded flex items-center justify-center font-bold">
              P
            </div>
            <h1 className="text-xl font-semibold">PDKS Personel</h1>
          </div>
          <div className="flex items-center">
            <span className="mr-4 hidden md:inline-block">
              <User className="inline-block mr-2 h-4 w-4" />
              {user?.name}
            </span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-white">
              <LogOut className="h-4 w-4 mr-1" />
              Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <h2 className="text-2xl font-bold mb-6">Personel Paneli</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <User className="h-4 w-4 mr-2 text-[#711A1A]" />
                Personel Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{user?.name}</p>
              <p className="text-sm text-gray-500">{user?.email}</p>
              <p className="text-sm text-gray-500">Kart No: {user?.card_number}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <Clock className="h-4 w-4 mr-2 text-[#711A1A]" />
                Bugün
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {format(new Date(), 'd MMMM yyyy', { locale: tr })}
              </p>
              <p className="text-sm text-gray-500">
                {format(new Date(), 'EEEE', { locale: tr })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <CalendarCheck className="h-4 w-4 mr-2 text-[#711A1A]" />
                Son Giriş
              </CardTitle>
            </CardHeader>
            <CardContent>
              {records.length > 0 ? (
                <>
                  <p className="text-lg font-semibold">
                    {format(new Date(records[0].date), 'd MMMM', { locale: tr })}
                  </p>
                  <p className="text-sm text-gray-500">
                    Giriş: {formatTime(records[0].entry_time)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-500">Henüz kayıt bulunmamakta</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Devam Kayıtları</CardTitle>
            <CardDescription>Son puantaj kayıtlarınız</CardDescription>
          </CardHeader>
          <CardContent>
            {error ? (
              <div className="text-center py-4 text-red-500">{error}</div>
            ) : records.length === 0 ? (
              <div className="text-center py-4 text-gray-500">Henüz kayıt bulunmamakta</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Giriş</TableHead>
                      <TableHead>Çıkış</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {format(new Date(record.date), 'dd.MM.yyyy', { locale: tr })}
                        </TableCell>
                        <TableCell>{formatTime(record.entry_time)}</TableCell>
                        <TableCell>{formatTime(record.exit_time)}</TableCell>
                        <TableCell>{getStatusBadge(record.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
