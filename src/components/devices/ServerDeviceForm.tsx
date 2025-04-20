
import { useState } from 'react';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormSelectField, FormTextField } from "@/components/employees/FormFields";
import { Button } from "@/components/ui/button";
import { ServerDevice, Project } from '@/types/device';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '../ui/input';

interface ServerDeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: ServerDevice | null;
  projects: Project[];
  onSuccess: () => void;
}

export function ServerDeviceForm({ 
  open, 
  onClose, 
  device, 
  projects,
  onSuccess 
}: ServerDeviceFormProps) {
  const [name, setName] = useState(device?.name || '');
  const [serialNumber, setSerialNumber] = useState(device?.serial_number || '');
  const [deviceModel, setDeviceModel] = useState<"QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other">(
    (device?.device_model_enum as any) || "QR Reader"
  );
  const [projectId, setProjectId] = useState(device?.project_id ? device.project_id.toString() : '');
  const [expiryDate, setExpiryDate] = useState(
    device?.expiry_date ? format(new Date(device.expiry_date), 'yyyy-MM-dd') : ''
  );
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const deviceData = {
      name,
      serial_number: serialNumber,
      device_model_enum: deviceModel,
      project_id: projectId ? parseInt(projectId) : null,
      expiry_date: expiryDate || null
    };

    try {
      if (device) {
        await supabase
          .from('server_devices')
          .update(deviceData)
          .eq('id', device.id);
      } else {
        await supabase
          .from('server_devices')
          .insert([deviceData]);
      }

      queryClient.invalidateQueries({ queryKey: ['server-devices'] });
      toast({
        title: `Device ${device ? 'updated' : 'added'} successfully`,
        variant: 'default'
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error saving device',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {device ? 'Edit Device' : 'Add New Device'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <FormTextField
            label="Device Name"
            name="name"
            value={name}
            onChange={setName}
            required
          />

          <FormTextField
            label="Serial Number"
            name="serial_number"
            value={serialNumber}
            onChange={setSerialNumber}
            required
          />

          <FormSelectField
            label="Device Model"
            name="device_model"
            value={deviceModel}
            onChange={(value) => setDeviceModel(value as "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other")}
            options={[
              { id: "QR Reader", name: "QR Reader" },
              { id: "Fingerprint Reader", name: "Fingerprint Reader" },
              { id: "RFID Reader", name: "RFID Reader" },
              { id: "Access Control Terminal", name: "Access Control Terminal" },
              { id: "Other", name: "Other" }
            ]}
            required
          />

          <FormSelectField
            label="Project"
            name="project"
            value={projectId}
            onChange={setProjectId}
            options={projects.map(project => ({
              id: project.id.toString(),
              name: project.name
            }))}
            placeholder="Select Project"
          />

          <div className="space-y-1">
            <label htmlFor="expiry_date" className="text-sm font-medium">
              Expiry Date
            </label>
            <Input
              id="expiry_date"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {device ? 'Update' : 'Add'} Device
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
