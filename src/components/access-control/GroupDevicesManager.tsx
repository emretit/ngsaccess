
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessRule, GroupDevice } from "@/types/access-control";
import { useDevices } from "@/hooks/useDevices";
import { useAccessRules } from "@/hooks/useAccessRules";

interface GroupDevicesManagerProps {
  rule: AccessRule;
  projectId?: number;
}

export function GroupDevicesManager({ rule, projectId }: GroupDevicesManagerProps) {
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { devices } = useDevices();
  const { updateAccessRuleWithAdditionalMembers, removeGroupDevice } = useAccessRules();

  const filteredDevices = devices?.filter(device => 
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.location?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const availableDevices = filteredDevices.filter(device => 
    !rule.group_devices?.some(groupDevice => groupDevice.device_id === Number(device.id))
  );

  const handleAddDevices = async () => {
    if (selectedDeviceIds.length === 0) return;
    
    // Mevcut cihaz ID'lerini al
    const existingDeviceIds = rule.group_devices?.map(gd => gd.device_id?.toString()).filter(Boolean) || [];
    
    // Sadece yeni cihazları belirle
    const newDeviceIds = selectedDeviceIds.filter(id => !existingDeviceIds.includes(id));
    
    if (newDeviceIds.length === 0) {
      console.log('Seçilen cihazlar zaten grupta mevcut');
      return;
    }

    try {
      await updateAccessRuleWithAdditionalMembers.mutateAsync({
        id: rule.id,
        updates: {}, // Sadece cihaz ekliyoruz, kural güncellemesi yok
        employeeIds: [], // Çalışan ekleme yok
        deviceIds: newDeviceIds.map(id => parseInt(id))
      });
      
      setSelectedDeviceIds([]);
      console.log(`${newDeviceIds.length} yeni cihaz gruba eklendi`);
    } catch (error) {
      console.error('Cihaz ekleme hatası:', error);
    }
  };

  const handleRemoveDevice = (groupDeviceId: number) => {
    removeGroupDevice.mutate(groupDeviceId);
  };

  const handleDeviceSelection = (deviceId: string) => {
    setSelectedDeviceIds(prev => {
      if (prev.includes(deviceId)) {
        return prev.filter(id => id !== deviceId);
      } else {
        return [...prev, deviceId];
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Grup Cihazları
          <Badge variant="secondary">{rule.group_devices?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new devices */}
        <div className="space-y-3">
          <Input
            placeholder="Cihaz ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
            {availableDevices.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                {searchTerm ? "Arama kriterine uygun cihaz bulunamadı" : "Eklenebilecek cihaz yok"}
              </div>
            ) : (
              availableDevices.map((device) => (
                <div 
                  key={device.id} 
                  className="flex items-center space-x-2 p-2 hover:bg-muted rounded cursor-pointer"
                  onClick={() => handleDeviceSelection(device.id.toString())}
                >
                  <input
                    type="checkbox"
                    checked={selectedDeviceIds.includes(device.id.toString())}
                    onChange={() => handleDeviceSelection(device.id.toString())}
                    className="rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{device.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {device.location}
                      {device.serial_number && ` • ${device.serial_number}`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <Button 
            onClick={handleAddDevices}
            disabled={selectedDeviceIds.length === 0 || updateAccessRuleWithAdditionalMembers.isPending}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Seçili Cihazları Ekle ({selectedDeviceIds.length})
          </Button>
        </div>

        {/* Current devices */}
        <div className="space-y-2">
          <h4 className="font-medium">Mevcut Cihazlar</h4>
          {rule.group_devices && rule.group_devices.length > 0 ? (
            rule.group_devices.map((groupDevice) => (
              <div key={groupDevice.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">
                    {groupDevice.devices?.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {groupDevice.devices?.location}
                    {(groupDevice.devices?.serial || groupDevice.devices?.serial_number) && 
                      ` • ${groupDevice.devices.serial || groupDevice.devices.serial_number}`
                    }
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDevice(groupDevice.id)}
                  disabled={removeGroupDevice.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-4">
              Bu gruba henüz cihaz eklenmemiş
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
