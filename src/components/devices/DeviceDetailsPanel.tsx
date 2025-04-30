
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ServerDeviceForm } from "@/components/devices/ServerDeviceForm";
import { ServerDevice, Project } from "@/types/device";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface DeviceDetailsPanelProps {
  open: boolean;
  onClose: () => void;
  selectedDevice: ServerDevice | null;
  onSuccess: () => void;
}

export function DeviceDetailsPanel({
  open,
  onClose,
  selectedDevice,
  onSuccess,
}: DeviceDetailsPanelProps) {
  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data as Project[];
    }
  });

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-md md:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {selectedDevice ? 'Cihazı Düzenle' : 'Yeni Cihaz Ekle'}
          </SheetTitle>
          <SheetDescription>
            {selectedDevice 
              ? 'Cihaz bilgilerini güncelleyebilirsiniz.' 
              : 'Yeni cihaz bilgilerini giriniz.'}
          </SheetDescription>
        </SheetHeader>

        {projectsLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ServerDeviceForm
            open={true}
            onClose={onClose}
            device={selectedDevice}
            projects={projects || []}
            onSuccess={onSuccess}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
