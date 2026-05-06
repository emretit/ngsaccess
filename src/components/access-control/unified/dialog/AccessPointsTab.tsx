import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDevices } from "@/hooks/useDevices";
import { useLocationUtils } from "@/hooks/useLocationUtils";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import type { Door, Zone } from "@/types/access-control";
import { Building2, Loader2, MapPin } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { EnhancedRuleFormData } from "./useEnhancedRuleForm";

interface AccessPointsTabProps {
  formData: EnhancedRuleFormData;
  setFormData: Dispatch<SetStateAction<EnhancedRuleFormData>>;
}

export function AccessPointsTab({ formData, setFormData }: AccessPointsTabProps) {
  const { devices, isLoading: devicesLoading } = useDevices();
  const { zones, doors, loading: zonesLoading } = useZonesAndDoors();
  const { getDeviceLocationDisplay } = useLocationUtils();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="h-5 w-5" />
          <span>Erişim Noktaları</span>
        </CardTitle>
        <CardDescription>
          Bu kural hangi cihaz, bölge veya kapılar için geçerli olacak?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="devices" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="devices">Cihazlar</TabsTrigger>
            <TabsTrigger value="zones">Bölgeler</TabsTrigger>
            <TabsTrigger value="doors">Kapılar</TabsTrigger>
          </TabsList>

          <TabsContent value="devices" className="space-y-3">
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {devicesLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : devices.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Cihaz yok
                </p>
              ) : (
                devices.map((device) => (
                  <div key={device._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`device-${device._id}`}
                      checked={formData.selectedDevices.includes(device._id)}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          selectedDevices: checked
                            ? [...prev.selectedDevices, device._id]
                            : prev.selectedDevices.filter((id) => id !== device._id),
                        }))
                      }
                    />
                    <MapPin className="h-4 w-4 text-green-500" />
                    <Label
                      htmlFor={`device-${device._id}`}
                      className="text-sm cursor-pointer"
                    >
                      {device.name} ({getDeviceLocationDisplay(device)})
                    </Label>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="zones" className="space-y-3">
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {zonesLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : zones.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Bölge yok
                </p>
              ) : (
                (zones as Zone[]).map((zone) => (
                  <div key={zone._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`zone-${zone._id}`}
                      checked={formData.selectedZones.includes(zone._id)}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          selectedZones: checked
                            ? [...prev.selectedZones, zone._id]
                            : prev.selectedZones.filter((id) => id !== zone._id),
                        }))
                      }
                    />
                    <Building2 className="h-4 w-4 text-purple-500" />
                    <Label
                      htmlFor={`zone-${zone._id}`}
                      className="text-sm cursor-pointer"
                    >
                      {zone.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="doors" className="space-y-3">
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {zonesLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : doors.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Kapı yok
                </p>
              ) : (
                (doors as Door[]).map((door) => (
                  <div key={door._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`door-${door._id}`}
                      checked={formData.selectedDoors.includes(door._id)}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          selectedDoors: checked
                            ? [...prev.selectedDoors, door._id]
                            : prev.selectedDoors.filter((id) => id !== door._id),
                        }))
                      }
                    />
                    <MapPin className="h-4 w-4 text-orange-500" />
                    <Label
                      htmlFor={`door-${door._id}`}
                      className="text-sm cursor-pointer"
                    >
                      {door.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex flex-wrap gap-2">
          {formData.selectedDevices.length > 0 && (
            <Badge variant="outline">{formData.selectedDevices.length} cihaz</Badge>
          )}
          {formData.selectedZones.length > 0 && (
            <Badge variant="outline">{formData.selectedZones.length} bölge</Badge>
          )}
          {formData.selectedDoors.length > 0 && (
            <Badge variant="outline">{formData.selectedDoors.length} kapı</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
