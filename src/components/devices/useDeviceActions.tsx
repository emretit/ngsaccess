import { useToast } from "@/hooks/use-toast";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function useDeviceActions() {
  const { toast } = useToast();
  const removeDevice = useMutation(api.devices.remove);

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await removeDevice({ deviceId: deviceId as Id<"devices"> });
      toast({ title: "Başarılı", description: "Cihaz başarıyla silindi" });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Cihaz silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  return { handleDeleteDevice };
}
