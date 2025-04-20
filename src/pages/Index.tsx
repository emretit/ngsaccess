
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Users, Cpu, Key, AlertCircle } from 'lucide-react';
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

        setRecentReadings(recent || []);
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
      <h1 className="text-2xl font-bold text-foreground">
        Welcome, {userName}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatusCard
          title="Total People"
          value={stats.employees.toString()}
          icon={<Users className="h-4 w-4 text-primary" />}
        />
        <StatusCard
          title="Active Devices"
          value={stats.devices.toString()}
          icon={<Cpu className="h-4 w-4 text-green-500" />}
        />
        <StatusCard
          title="Today's Openings"
          value={stats.cardReadings.toString()}
          icon={<Key className="h-4 w-4 text-yellow-500" />}
        />
        <StatusCard
          title="Pending Requests"
          value={stats.pendingRequests.toString()}
          icon={<AlertCircle className="h-4 w-4 text-red-500" />}
        />
      </div>

      <div className="bg-card rounded-lg shadow-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">
              Recent Card Readings
            </h2>
            <Link 
              to="/access-control" 
              className="text-primary hover:text-primary/80 text-sm"
            >
              View All
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : recentReadings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      No recent card readings
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
                          {reading.status === 'success' ? 'Granted' : 'Denied'}
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
