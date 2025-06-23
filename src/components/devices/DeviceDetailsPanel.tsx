
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceForm } from "@/components/devices/DeviceForm";
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
      <SheetContent className="sm:max-w-md md:max-w-lg w-full p-0">
        <SheetHeader className="p-6 border-b">
          <SheetTitle>
            {selectedDevice ? 'Cihazı Düzenle' : 'Yeni Cihaz Ekle'}
          </SheetTitle>
        </SheetHeader>

        {projectsLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-120px)]">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Yükleniyor...</span>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-120px)]">
            <DeviceForm
              open={true}
              onClose={onClose}
              device={selectedDevice}
              projects={projects || []}
              onSuccess={onSuccess}
            />
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
