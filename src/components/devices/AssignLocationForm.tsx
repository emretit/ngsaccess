
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
  onSubmit: (zoneId: number, doorId: number) => Promise<void>;
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

  // Set initial values only when dialog opens and device changes
  useEffect(() => {
    if (open && device) {
      const zoneValue = device.zone_id ? device.zone_id.toString() : "";
      const doorValue = device.door_id ? device.door_id.toString() : "";
      
      if (selectedZoneId !== zoneValue) {
        setSelectedZoneId(zoneValue);
      }
      if (selectedDoorId !== doorValue) {
        setSelectedDoorId(doorValue);
      }
    } else if (open && !device) {
      // Reset form when opening for a new device
      setSelectedZoneId("");
      setSelectedDoorId("");
    }
  }, [open, device?.zone_id, device?.door_id]); // Only depend on open state and device IDs

  // Filter doors when zone changes or doors data updates
  useEffect(() => {
    if (selectedZoneId && doors.length > 0) {
      const zoneIdNumber = parseInt(selectedZoneId, 10);
      const filtered = doors.filter(door => door.zone_id === zoneIdNumber);
      setFilteredDoors(filtered);
      
      // Only reset door selection if current door is not in the filtered list
      if (selectedDoorId && !filtered.some(door => door.id.toString() === selectedDoorId)) {
        setSelectedDoorId("");
      }
    } else {
      setFilteredDoors([]);
      if (selectedDoorId) {
        setSelectedDoorId("");
      }
    }
  }, [selectedZoneId, doors]); // Removed selectedDoorId from dependencies to prevent loop

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
      await onSubmit(parseInt(selectedZoneId, 10), parseInt(selectedDoorId, 10));
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
                    <SelectItem key={zone.id} value={zone.id.toString()}>
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
                    <SelectItem key={door.id} value={door.id.toString()}>
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
