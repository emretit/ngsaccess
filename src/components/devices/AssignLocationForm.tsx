
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

interface AssignLocationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (zoneId: number, doorId: number) => Promise<void>;
  deviceName: string;
}

export function AssignLocationForm({
  open,
  onClose,
  onSubmit,
  deviceName,
}: AssignLocationFormProps) {
  const { toast } = useToast();
  const { zones, doors, loading } = useZonesAndDoors();
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedDoorId, setSelectedDoorId] = useState<string>("");
  const [filteredDoors, setFilteredDoors] = useState<typeof doors>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter doors when zone changes
  useEffect(() => {
    if (selectedZoneId) {
      // Convert string to number for comparison
      const zoneIdNumber = parseInt(selectedZoneId, 10);
      setFilteredDoors(doors.filter(door => door.zone_id === zoneIdNumber));
      setSelectedDoorId(""); // Reset door selection when zone changes
    } else {
      setFilteredDoors([]);
      setSelectedDoorId("");
    }
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
      // Convert string IDs to numbers
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
