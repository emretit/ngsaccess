
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

interface DeviceFormProps {
  onAddDevice: (serialNumber: string) => void;
  isLoading: boolean;
}

export function DeviceForm({ onAddDevice, isLoading }: DeviceFormProps) {
  const [serialNumber, setSerialNumber] = useState('');
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (serialNumber.trim()) {
      onAddDevice(serialNumber.trim());
      setSerialNumber('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Device
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Device</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <label htmlFor="serialNumber" className="text-sm font-medium">
              Serial Number
            </label>
            <Input
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="Enter device serial number"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500">
              Enter the serial number of the device you want to add. The system will automatically validate and populate device details.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading || !serialNumber.trim()}>
              {isLoading ? 'Adding...' : 'Add Device'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
