
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
import { Input } from "@/components/ui/input";
import { Plus, Search, MoreVertical, Edit, Trash2, RefreshCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    fetchDevices();
  }, []);

  async function fetchDevices() {
    setLoading(true);
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

  // Filtreleme fonksiyonu
  const filteredDevices = devices.filter(device => {
    return searchTerm === "" || 
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      device.device_serial.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleRefresh = () => {
    fetchDevices();
  };

  return (
    <main className="flex-1 p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">Cihazlar</h1>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Cihaz ara..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} title="Yenile">
                <RefreshCcw size={16} />
              </Button>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Yeni Cihaz
              </Button>
            </div>
          </div>
        </div>
        
        <div className="flex mb-4 justify-end">
          <div className="flex gap-2 bg-white rounded-md border p-1">
            <Button 
              size="sm" 
              variant={viewMode === 'table' ? "default" : "ghost"} 
              className="h-8 px-3" 
              onClick={() => setViewMode('table')}
            >
              Tablo
            </Button>
            <Button 
              size="sm" 
              variant={viewMode === 'grid' ? "default" : "ghost"} 
              className="h-8 px-3" 
              onClick={() => setViewMode('grid')}
            >
              Grid
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="glass-card flex justify-center items-center py-12">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-200"></div>
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-400"></div>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-semibold">Cihaz Adı</TableHead>
                    <TableHead className="font-semibold">Konum</TableHead>
                    <TableHead className="font-semibold">Tip</TableHead>
                    <TableHead className="font-semibold">Seri No</TableHead>
                    <TableHead className="font-semibold">Son Görülme</TableHead>
                    <TableHead className="font-semibold">Durum</TableHead>
                    <TableHead className="font-semibold">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        {searchTerm 
                          ? "Arama kriterlerine uygun cihaz bulunamadı" 
                          : "Henüz cihaz bulunmuyor"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices.map((device) => (
                      <TableRow key={device.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell>{device.location}</TableCell>
                        <TableCell>{device.type}</TableCell>
                        <TableCell className="font-mono text-xs">{device.device_serial}</TableCell>
                        <TableCell>{new Date(device.last_seen).toLocaleString('tr-TR')}</TableCell>
                        <TableCell>
                          <Badge variant={device.status === 'active' ? "success" : "destructive"} className="pill-badge">
                            {device.status === 'active' ? 'Aktif' : 'Pasif'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem className="flex items-center">
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Düzenle</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="flex items-center text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Sil</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDevices.length === 0 ? (
              <div className="col-span-full text-center py-12 text-gray-500 glass-card">
                {searchTerm 
                  ? "Arama kriterlerine uygun cihaz bulunamadı" 
                  : "Henüz cihaz bulunmuyor"}
              </div>
            ) : (
              filteredDevices.map((device) => (
                <Card key={device.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{device.name}</CardTitle>
                        <CardDescription>{device.location}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="flex items-center">
                            <Edit className="mr-2 h-4 w-4" />
                            <span>Düzenle</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="flex items-center text-red-600">
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Sil</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-500">Tip:</div>
                      <div>{device.type}</div>
                      <div className="text-gray-500">Seri No:</div>
                      <div className="font-mono text-xs">{device.device_serial}</div>
                      <div className="text-gray-500">Son Görülme:</div>
                      <div>{new Date(device.last_seen).toLocaleString('tr-TR')}</div>
                    </div>
                  </CardContent>
                  <CardFooter className="pt-2 flex justify-between items-center">
                    <Badge variant={device.status === 'active' ? "success" : "destructive"} className="pill-badge">
                      {device.status === 'active' ? 'Aktif' : 'Pasif'}
                    </Badge>
                    <Button variant="outline" size="sm">
                      Ayrıntılar
                    </Button>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </main>
  );
}
