
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Monitor, Edit, Trash2, Plus, Wifi, WifiOff } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface Device {
  id: number;
  name: string;
  location: string;
  type: string;
  status: string;
  device_serial?: string;
  device_mac?: string;
  last_seen?: string;
  created_at?: string;
  is_active: boolean;
}

const AdminDevicesPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentDevice, setCurrentDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    type: 'card_reader',
    device_serial: '',
    device_mac: '',
    status: 'active'
  });
  const { toast } = useToast();

  const { data: devices = [], refetch: refetchDevices } = useQuery({
    queryKey: ['admin', 'devices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          variant: "destructive",
          title: "Cihazlar yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      return data as Device[];
    }
  });

  const filteredDevices = devices.filter(device => 
    device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    device.location.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateDevice = () => {
    setCurrentDevice(null);
    setFormData({
      name: '',
      location: '',
      type: 'card_reader',
      device_serial: '',
      device_mac: '',
      status: 'active'
    });
    setIsDialogOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setCurrentDevice(device);
    setFormData({
      name: device.name,
      location: device.location,
      type: device.type,
      device_serial: device.device_serial || '',
      device_mac: device.device_mac || '',
      status: device.status
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (device: Device) => {
    setCurrentDevice(device);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveDevice = async () => {
    try {
      if (!formData.name) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Cihaz adı zorunludur"
        });
        return;
      }

      if (!formData.location) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Konum zorunludur"
        });
        return;
      }

      if (currentDevice) {
        const { error } = await supabase
          .from('devices')
          .update({
            name: formData.name,
            location: formData.location,
            type: formData.type,
            device_serial: formData.device_serial,
            device_mac: formData.device_mac,
            status: formData.status
          })
          .eq('id', currentDevice.id);

        if (error) throw error;
        
        toast({
          title: "Cihaz güncellendi",
          description: "Cihaz bilgileri başarıyla güncellendi"
        });
      } else {
        const { error } = await supabase
          .from('devices')
          .insert({
            name: formData.name,
            location: formData.location,
            type: formData.type,
            device_serial: formData.device_serial,
            device_mac: formData.device_mac,
            status: formData.status,
            is_active: true
          });

        if (error) throw error;
        
        toast({
          title: "Cihaz oluşturuldu",
          description: "Yeni cihaz başarıyla oluşturuldu"
        });
      }

      setIsDialogOpen(false);
      refetchDevices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Cihaz kaydedilirken bir hata oluştu"
      });
    }
  };

  const handleDeleteDevice = async () => {
    if (!currentDevice) return;

    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', currentDevice.id);

      if (error) throw error;
      
      toast({
        title: "Cihaz silindi",
        description: "Cihaz başarıyla silindi"
      });
      
      setIsDeleteDialogOpen(false);
      refetchDevices();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Cihaz silinirken bir hata oluştu"
      });
    }
  };

  const getStatusDisplay = (status: string, lastSeen?: string) => {
    const isOnline = status === 'active' && lastSeen && 
                   new Date(lastSeen) > new Date(Date.now() - 5 * 60 * 1000); // 5 dakika
    
    if (isOnline) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold px-4 py-2">
          <Wifi className="w-4 h-4 mr-2" />
          Çevrimiçi
        </Badge>
      );
    } else if (status === 'active') {
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 font-bold px-4 py-2">
          <WifiOff className="w-4 h-4 mr-2" />
          Çevrimdışı
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-bold px-4 py-2">
          <WifiOff className="w-4 h-4 mr-2" />
          Pasif
        </Badge>
      );
    }
  };

  const getTypeDisplay = (type: string) => {
    switch (type) {
      case 'card_reader':
        return 'Kart Okuyucu';
      case 'access_control':
        return 'Erişim Kontrolü';
      case 'time_attendance':
        return 'Zaman Takip';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Cihaz Yönetimi
          </h3>
          <p className="text-purple-300 mt-2 text-lg">Sistem cihazlarını yönetin</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400" />
            <Input
              type="search"
              placeholder="Cihaz ara..."
              className="w-80 pl-10 bg-white/10 border-white/20 text-white placeholder:text-purple-300 focus:bg-white/15 focus:border-purple-400 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleCreateDevice}
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-xl shadow-xl hover:scale-105 transition-all duration-300 border-0"
          >
            <Plus className="h-5 w-5 mr-3" />
            Yeni Cihaz
          </Button>
        </div>
      </div>

      {/* Enhanced Table Container */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8">
          <Table>
            <TableHeader>
              <TableRow className="border-white/20 hover:bg-white/5">
                <TableHead className="text-purple-200 font-bold text-lg">Cihaz Adı</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Konum</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Tip</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Durum</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Son Görülme</TableHead>
                <TableHead className="text-right text-purple-200 font-bold text-lg">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-purple-300 text-lg">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Monitor className="w-8 h-8 text-purple-400" />
                      </div>
                      <span>Cihaz bulunamadı</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => (
                  <TableRow key={device.id} className="border-white/10 hover:bg-white/5 transition-all duration-300 group">
                    <TableCell className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors duration-300">
                      {device.name}
                    </TableCell>
                    <TableCell className="text-purple-200">
                      {device.location}
                    </TableCell>
                    <TableCell className="text-purple-200">
                      {getTypeDisplay(device.type)}
                    </TableCell>
                    <TableCell>
                      {getStatusDisplay(device.status, device.last_seen)}
                    </TableCell>
                    <TableCell className="text-purple-200">
                      {device.last_seen ? 
                        format(new Date(device.last_seen), 'dd.MM.yyyy HH:mm') : 
                        <span className="text-purple-400 italic">Hiç görülmedi</span>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditDevice(device)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-all duration-300 rounded-xl"
                        >
                          <Edit className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-300 rounded-xl"
                          onClick={() => handleDeleteClick(device)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Device Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{currentDevice ? 'Cihaz Düzenle' : 'Yeni Cihaz'}</DialogTitle>
            <DialogDescription>
              {currentDevice ? 'Cihaz bilgilerini güncelleyin' : 'Sisteme yeni bir cihaz ekleyin'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Cihaz Adı*</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="location">Konum*</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="type">Cihaz Tipi</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tip seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="card_reader">Kart Okuyucu</SelectItem>
                    <SelectItem value="access_control">Erişim Kontrolü</SelectItem>
                    <SelectItem value="time_attendance">Zaman Takip</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="device_serial">Seri Numarası</Label>
              <Input
                id="device_serial"
                value={formData.device_serial}
                onChange={(e) => setFormData({ ...formData, device_serial: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="device_mac">MAC Adresi</Label>
              <Input
                id="device_mac"
                value={formData.device_mac}
                onChange={(e) => setFormData({ ...formData, device_mac: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Durum</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Durum seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Pasif</SelectItem>
                    <SelectItem value="maintenance">Bakımda</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveDevice}>
              {currentDevice ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cihaz Silme</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. "{currentDevice?.name}" cihazını silmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteDevice}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDevicesPanel;
