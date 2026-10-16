import { useAsyncAction } from "@/hooks/useAsyncAction";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors"; 
import { ServerDevice } from '@/types/device';

interface AssignLocationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (zoneId: string, doorId: string) => Promise<void>;
  deviceName: string;
  device?: ServerDevice;
}

export function AssignLocationForm({
  open,
  onClose,
  onSubmit,
  deviceName,
  device
}: AssignLocationFormProps) {
  const isPanel = device?.brand === "ide_smart" || device?.brand === "hikvision";
  const { zones, doors, loading } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedDoorId, setSelectedDoorId] = useState<string>("");
  const [filteredDoors, setFilteredDoors] = useState<typeof doors>([]);


  useEffect(() => {
    if (open && device) {
      const zoneValue = device.zoneId ?? "";
      const doorValue = device.doorId ?? "";

      if (selectedZoneId !== zoneValue) {
        setSelectedZoneId(zoneValue);
      }
      if (selectedDoorId !== doorValue) {
        setSelectedDoorId(doorValue);
      }
    } else if (open && !device) {
      setSelectedZoneId("");
      setSelectedDoorId("");
    }
    // selectedZoneId/selectedDoorId deps'e eklenince loop oluşur — bilinçli olarak sadece prop'lara bağlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device?.zoneId, device?.doorId]);

  useEffect(() => {
    if (selectedZoneId && doors.length > 0) {
      const filtered = doors.filter(door => door.zoneId === selectedZoneId && (!door.deviceId || door.deviceId === device?._id));
      setFilteredDoors(filtered);

      if (selectedDoorId && !filtered.some(door => door._id === selectedDoorId)) {
        setSelectedDoorId("");
      }
    } else {
      setFilteredDoors([]);
      if (selectedDoorId) {
        setSelectedDoorId("");
      }
    }
    // selectedDoorId yalnızca koşul kontrolünde okunur; deps'e eklenince gereksiz tekrar tetiklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId, doors]);

  const { run: assign, pending: isSubmitting } = useAsyncAction(async () => {
    if (!selectedZoneId || (!isPanel && !selectedDoorId)) throw new Error("Lütfen bölge ve kapı seçin");
    await onSubmit(selectedZoneId, selectedDoorId);
    toast.success(`${deviceName} cihazının konumu güncellendi.`);
  }, { error: "Konum atanamadı" });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await assign()) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !isSubmitting) onClose(); }}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{deviceName} — Konum Ata</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="zone" className="text-right">
                Bölge
              </Label>
              <Select
                value={selectedZoneId}
                onValueChange={setSelectedZoneId}
                disabled={loading || isSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Bölge seçin" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone._id} value={zone._id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isPanel ? <p className="text-sm text-muted-foreground">Panelin tüm kapıları ve okuyucuları seçilen bölgeye taşınır. Kapı eşlemesi değiştirilmez.</p> : <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="door" className="text-right">
                Kapı
              </Label>
              <Select
                value={selectedDoorId}
                onValueChange={setSelectedDoorId}
                disabled={!selectedZoneId || loading || isSubmitting}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Kapı seçin" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDoors.map((door) => (
                    <SelectItem key={door._id} value={door._id}>
                      {door.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedZoneId || (!isPanel && !selectedDoorId)}>
              {isSubmitting ? "Atanıyor..." : "Konum Ata"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
