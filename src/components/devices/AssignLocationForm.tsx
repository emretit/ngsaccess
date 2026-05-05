
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
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();
  const { zones, doors, loading } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedDoorId, setSelectedDoorId] = useState<string>("");
  const [filteredDoors, setFilteredDoors] = useState<typeof doors>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const filtered = doors.filter(door => door.zoneId === selectedZoneId);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedZoneId || !selectedDoorId) {
      toast({
        title: "Validation Error",
        description: "Please select both zone and door",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await onSubmit(selectedZoneId, selectedDoorId);
      toast({
        title: "Location assigned",
        description: `${deviceName} has been assigned to the selected location.`,
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to assign location",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Assign Location to {deviceName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="zone" className="text-right">
                Zone
              </Label>
              <Select
                value={selectedZoneId}
                onValueChange={setSelectedZoneId}
                disabled={loading}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a zone" />
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="door" className="text-right">
                Door
              </Label>
              <Select
                value={selectedDoorId}
                onValueChange={setSelectedDoorId}
                disabled={!selectedZoneId || loading}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a door" />
                </SelectTrigger>
                <SelectContent>
                  {filteredDoors.map((door) => (
                    <SelectItem key={door._id} value={door._id}>
                      {door.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedZoneId || !selectedDoorId}>
              {isSubmitting ? "Assigning..." : "Assign Location"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
