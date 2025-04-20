
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ServerDevice, Project } from '@/types/device';
import { useServerDeviceForm } from '@/hooks/useServerDeviceForm';
import { ServerDeviceFormFields } from './ServerDeviceFormFields';

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
  const {
    name,
    setName,
    serialNumber,
    setSerialNumber,
    deviceModel,
    setDeviceModel,
    projectId,
    setProjectId,
    expiryDate,
    setExpiryDate,
    handleSubmit
  } = useServerDeviceForm(device || null, onSuccess);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {device ? 'Edit Device' : 'Add New Device'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ServerDeviceFormFields
            name={name}
            onNameChange={setName}
            serialNumber={serialNumber}
            onSerialNumberChange={setSerialNumber}
            deviceModel={deviceModel}
            onDeviceModelChange={setDeviceModel}
            projectId={projectId}
            onProjectChange={setProjectId}
            expiryDate={expiryDate}
            onExpiryDateChange={setExpiryDate}
            projects={projects}
          />

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
