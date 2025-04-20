
import { Device, Project } from "@/types/device";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DeviceFormProps {
  open: boolean;
  onClose: () => void;
  device?: Device;
  projects: Project[];
  onSuccess: () => void;
}

export function DeviceForm({ open, onClose, device, projects, onSuccess }: DeviceFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: device?.name || '',
    serial_number: device?.serial_number || '',
    device_model: device?.device_model || '',
    project_id: device?.project_id?.toString() || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (device?.id) {
        await supabase
          .from('server_devices')
          .update({
            name: formData.name,
            serial_number: formData.serial_number,
            device_model: formData.device_model,
            project_id: parseInt(formData.project_id),
          })
          .eq('id', device.id);
      } else {
        await supabase
          .from('server_devices')
          .insert([{
            name: formData.name,
            serial_number: formData.serial_number,
            device_model: formData.device_model,
            project_id: parseInt(formData.project_id),
            status: 'active',
          }]);
      }
      
      toast.success(device ? 'Device updated' : 'Device added');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[425px]">
        <SheetHeader>
          <SheetTitle>{device ? 'Edit Device' : 'Add New Device'}</SheetTitle>
        </SheetHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="serial">Serial Number</Label>
            <Input
              id="serial"
              value={formData.serial_number}
              onChange={e => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={formData.device_model}
              onChange={e => setFormData(prev => ({ ...prev, device_model: e.target.value }))}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="project">Project</Label>
            <Select
              value={formData.project_id}
              onValueChange={value => setFormData(prev => ({ ...prev, project_id: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <SheetFooter className="mt-4">
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-burgundy hover:bg-burgundy/90"
            >
              {device ? 'Update Device' : 'Add Device'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
