
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessRule } from "@/types/access-control";
import { useDevices } from "@/hooks/useDevices";
import { useAccessRules } from "@/hooks/useAccessRules";
import { useLocationUtils } from "@/hooks/useLocationUtils";
import type { Id } from "../../../convex/_generated/dataModel";

interface GroupDevicesManagerProps {
  rule: AccessRule;
  projectId?: string;
}

export function GroupDevicesManager({ rule, projectId }: GroupDevicesManagerProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { devices } = useDevices();
  const { addGroupDevice, removeGroupDevice } = useAccessRules();
  const { getDeviceLocationDisplay } = useLocationUtils();

  const filteredDevices = devices?.filter(device => 
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getDeviceLocationDisplay(device).toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const availableDevices = filteredDevices.filter(device =>
    !rule.groupDevices?.some(groupDevice => groupDevice.deviceId === device._id)
  );

  const handleAddDevice = () => {
    if (selectedDeviceId) {
      addGroupDevice.mutate({
        groupId: rule._id,
        deviceId: selectedDeviceId as Id<"devices">,
        projectId: projectId as Id<"projects"> | undefined,
      });
      setSelectedDeviceId("");
    }
  };

  const handleRemoveDevice = (groupDeviceId: string) => {
    removeGroupDevice.mutate(groupDeviceId as Id<"groupDevices">);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Grup Cihazları
          <Badge variant="secondary">{rule.groupDevices?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new device */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Cihaz ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="Cihaz seçin" />
              </SelectTrigger>
              <SelectContent>
                {availableDevices.map((device) => (
                  <SelectItem key={device._id} value={device._id}>
                    {device.name} - {getDeviceLocationDisplay(device)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleAddDevice}
            disabled={!selectedDeviceId || addGroupDevice.isPending}
            className="mt-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            Ekle
          </Button>
        </div>

        {/* Current devices */}
        <div className="space-y-2">
          {rule.groupDevices?.map((groupDevice) => {
            const device = devices.find(d => d._id === groupDevice.deviceId);
            return (
              <div key={groupDevice._id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <div className="font-medium">
                    {groupDevice.devices?.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {device ? getDeviceLocationDisplay(device) : 'Konum Bilinmiyor'}
                    {groupDevice.devices?.deviceSerial &&
                      ` • ${groupDevice.devices.deviceSerial}`
                    }
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDevice(groupDevice._id)}
                  disabled={removeGroupDevice.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          }) || (
            <div className="text-center text-muted-foreground py-4">
              Bu gruba henüz cihaz eklenmemiş
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
