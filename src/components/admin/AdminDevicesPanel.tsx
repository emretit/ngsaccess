
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Monitor, Smartphone, Shield } from "lucide-react";
import { format } from "date-fns";
import { ServerDevice } from "@/types/device";

export default function AdminDevicesPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDevice, setSelectedDevice] = useState<ServerDevice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fetch server devices
  const { data: devices = [], isLoading, refetch } = useQuery({
    queryKey: ["admin", "server-devices", searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("server_devices")
        .select("*, projects(name)")
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,serial_number.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ServerDevice[];
    },
  });

  // Fetch device statistics
  const { data: stats } = useQuery({
    queryKey: ["admin", "device-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("server_devices")
        .select("status, device_model_enum");

      if (error) throw error;

      const total = data?.length || 0;
      const active = data?.filter(d => d.status === "active").length || 0;
      const inactive = data?.filter(d => d.status === "inactive").length || 0;
      const byType = data?.reduce((acc, device) => {
        const type = device.device_model_enum || "Other";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return { total, active, inactive, byType };
    },
  });

  const getStatusBadge = (status: string) => {
    if (status === "active") {
      return <Badge className="bg-green-500 hover:bg-green-600">Aktif</Badge>;
    } else if (status === "inactive") {
      return <Badge variant="destructive">Pasif</Badge>;
    }
    return <Badge variant="secondary">Bilinmiyor</Badge>;
  };

  const getDeviceIcon = (type: string) => {
    if (type?.includes("Reader") || type?.includes("Terminal")) {
      return <Shield className="w-4 h-4" />;
    } else if (type?.includes("Mobile")) {
      return <Smartphone className="w-4 h-4" />;
    }
    return <Monitor className="w-4 h-4" />;
  };

  const handleDeviceClick = (device: ServerDevice) => {
    setSelectedDevice(device);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Cihaz Yönetimi
          </h3>
          <p className="text-purple-300 mt-2 text-lg">
            Tüm sistem cihazlarını merkezi olarak yönetin
          </p>
        </div>
        <Button className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:scale-105 transition-transform duration-300 shadow-xl">
          <Plus className="w-5 h-5 mr-2" />
          Yeni Cihaz
        </Button>
      </div>

      {/* Device Statistics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Toplam Cihaz</CardTitle>
            <div className="w-12 h-12 bg-blue-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Monitor className="h-6 w-6 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-2">{stats?.total || 0}</div>
            <p className="text-blue-400 text-sm font-medium">Kayıtlı cihaz sayısı</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Aktif Cihaz</CardTitle>
            <div className="w-12 h-12 bg-green-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Shield className="h-6 w-6 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-2">{stats?.active || 0}</div>
            <p className="text-green-400 text-sm font-medium">Çalışır durumda</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-pink-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Pasif Cihaz</CardTitle>
            <div className="w-12 h-12 bg-red-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Monitor className="h-6 w-6 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-2">{stats?.inactive || 0}</div>
            <p className="text-red-400 text-sm font-medium">Devre dışı</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Okuyucu</CardTitle>
            <div className="w-12 h-12 bg-purple-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Smartphone className="h-6 w-6 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-white mb-2">
              {Object.values(stats?.byType || {}).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-purple-400 text-sm font-medium">Tüm tip cihazlar</p>
          </CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card className="bg-white/10 border-white/20 backdrop-blur-xl shadow-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-white">Cihaz Listesi</CardTitle>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-4 h-4" />
                <Input
                  placeholder="Cihaz ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-purple-300"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/20">
                  <TableHead className="text-purple-200">Cihaz</TableHead>
                  <TableHead className="text-purple-200">Seri No</TableHead>
                  <TableHead className="text-purple-200">Tip</TableHead>
                  <TableHead className="text-purple-200">Proje</TableHead>
                  <TableHead className="text-purple-200">Durum</TableHead>
                  <TableHead className="text-purple-200">Ekleme Tarihi</TableHead>
                  <TableHead className="text-purple-200">Son Kullanım</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-purple-300">
                      Yükleniyor...
                    </TableCell>
                  </TableRow>
                ) : devices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-purple-300">
                      Cihaz bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  devices.map((device) => (
                    <TableRow 
                      key={device.id} 
                      className="border-white/10 hover:bg-white/5 cursor-pointer transition-colors duration-200"
                      onClick={() => handleDeviceClick(device)}
                    >
                      <TableCell className="text-white">
                        <div className="flex items-center gap-3">
                          {getDeviceIcon(device.device_model_enum || "")}
                          <span className="font-medium">{device.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-purple-200 font-mono">{device.serial_number}</TableCell>
                      <TableCell className="text-purple-200">{device.device_model_enum || "-"}</TableCell>
                      <TableCell className="text-purple-200">{device.projects?.name || "-"}</TableCell>
                      <TableCell>{getStatusBadge(device.status)}</TableCell>
                      <TableCell className="text-purple-200">
                        {device.date_added ? format(new Date(device.date_added), "dd.MM.yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-purple-200">
                        {device.last_used_at ? format(new Date(device.last_used_at), "dd.MM.yyyy HH:mm") : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Device Details Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-slate-900/95 border-white/20 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">
              {selectedDevice?.name}
            </DialogTitle>
            <DialogDescription className="text-purple-300">
              Cihaz detayları ve sistem bilgileri
            </DialogDescription>
          </DialogHeader>
          
          {selectedDevice && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-purple-200">Cihaz Adı</label>
                    <p className="text-white font-semibold">{selectedDevice.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-purple-200">Seri Numarası</label>
                    <p className="text-white font-mono">{selectedDevice.serial_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-purple-200">Cihaz Tipi</label>
                    <p className="text-white">{selectedDevice.device_model_enum || "-"}</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-purple-200">Durum</label>
                    <div className="mt-1">{getStatusBadge(selectedDevice.status)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-purple-200">Proje</label>
                    <p className="text-white">{selectedDevice.projects?.name || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-purple-200">Ekleme Tarihi</label>
                    <p className="text-white">
                      {selectedDevice.date_added ? format(new Date(selectedDevice.date_added), "dd.MM.yyyy HH:mm") : "-"}
                    </p>
                  </div>
                </div>
              </div>
              
              {selectedDevice.last_used_at && (
                <div>
                  <label className="text-sm font-medium text-purple-200">Son Kullanım</label>
                  <p className="text-white">{format(new Date(selectedDevice.last_used_at), "dd.MM.yyyy HH:mm")}</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
