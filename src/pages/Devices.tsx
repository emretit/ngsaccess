
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Device {
  id: number;
  name: string;
  location: string;
  type: string;
  status: string;
  device_serial: string;
  last_seen: string;
}

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  async function fetchDevices() {
    try {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDevices(data || []);
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 p-6 bg-gray-50">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cihazlar</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Cihaz
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cihaz Adı</TableHead>
              <TableHead>Konum</TableHead>
              <TableHead>Tip</TableHead>
              <TableHead>Seri No</TableHead>
              <TableHead>Son Görülme</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => (
              <TableRow key={device.id}>
                <TableCell>{device.name}</TableCell>
                <TableCell>{device.location}</TableCell>
                <TableCell>{device.type}</TableCell>
                <TableCell>{device.device_serial}</TableCell>
                <TableCell>{new Date(device.last_seen).toLocaleString('tr-TR')}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    device.status === 'active' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {device.status === 'active' ? 'Aktif' : 'Pasif'}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    Düzenle
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
