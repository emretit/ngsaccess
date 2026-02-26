import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { ServerDevice } from "@/types/device";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Loader2 } from "lucide-react";

interface DeviceDetailsPanelProps {
  open: boolean;
  onClose: () => void;
  selectedDevice: ServerDevice | null;
  onSuccess: () => void;
}

export function DeviceDetailsPanel({ open, onClose, selectedDevice, onSuccess }: DeviceDetailsPanelProps) {
  const projectsData = useQuery(api.projects.list);
  const projectsLoading = projectsData === undefined;
  const projects = (projectsData ?? []).map((p: { _id: string; name: string }) => ({ id: p._id, name: p.name }));

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="px-8 py-6 border-b bg-gradient-to-r from-gray-50 to-gray-100/50">
          <SheetTitle className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-2 h-8 bg-burgundy rounded-full"></div>
            {selectedDevice ? "Cihazı Düzenle" : "Yeni Cihaz Ekle"}
          </SheetTitle>
        </SheetHeader>

        {projectsLoading ? (
          <div className="flex items-center justify-center flex-1 bg-gray-50/30">
            <div className="flex flex-col items-center gap-4 p-8">
              <div className="relative">
                <Loader2 className="h-10 w-10 animate-spin text-burgundy" />
                <div className="absolute inset-0 h-10 w-10 border-2 border-burgundy/20 rounded-full"></div>
              </div>
              <div className="text-center">
                <span className="text-base font-medium text-gray-700">Yükleniyor...</span>
                <p className="text-sm text-gray-500 mt-1">Proje bilgileri getiriliyor</p>
              </div>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-8">
              <DeviceForm
                selectedDevice={selectedDevice}
                projects={projects}
                onSuccess={onSuccess}
                onCancel={onClose}
              />
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
