
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <div className="flex-shrink-0 p-6 border-b bg-white">
          <SheetHeader>
            <SheetTitle className="text-xl font-semibold">
              {selectedDevice ? 'Cihazı Düzenle' : 'Yeni Cihaz Ekle'}
            </SheetTitle>
            <SheetDescription className="text-gray-600">
              {selectedDevice 
                ? 'Cihaz bilgilerini güncelleyebilirsiniz.' 
                : 'Yeni cihaz bilgilerini giriniz.'}
            </SheetDescription>
          </SheetHeader>
        </div>

        {projectsLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Yükleniyor...</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <ScrollArea className="flex-1">
              <div className="p-6">
                <ServerDeviceForm
                  open={true}
                  onClose={onClose}
                  device={selectedDevice}
                  projects={projects || []}
                  onSuccess={onSuccess}
                />
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
