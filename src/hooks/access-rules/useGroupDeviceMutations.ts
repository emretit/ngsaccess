import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { Id } from "../../../convex/_generated/dataModel";

export const useGroupDeviceMutations = () => {
  const { toast } = useToast();

  const addGroupDeviceMut = useMutation(api.accessRules.addGroupDevice);
  const removeGroupDeviceMut = useMutation(api.accessRules.removeGroupDevice);

  const addGroupDevice = {
    mutateAsync: async ({
      groupId,
      deviceId,
      projectId,
    }: {
      groupId: Id<"accessRules">;
      deviceId: Id<"devices">;
      projectId?: Id<"projects">;
    }) => {
      const result = await addGroupDeviceMut({ groupId, deviceId, projectId });
      toast({ title: "Başarılı", description: "Cihaz gruba eklendi." });
      return result;
    },
    mutate: (args: { groupId: Id<"accessRules">; deviceId: Id<"devices">; projectId?: Id<"projects"> }) => {
      addGroupDeviceMut(args)
        .then(() => toast({ title: "Başarılı", description: "Cihaz gruba eklendi." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Cihaz gruba eklenemedi." })
        );
    },
    isPending: false,
  };

  const removeGroupDevice = {
    mutateAsync: async (groupDeviceId: Id<"groupDevices">) => {
      await removeGroupDeviceMut({ groupDeviceId });
      toast({ title: "Başarılı", description: "Cihaz gruptan çıkarıldı." });
    },
    mutate: (groupDeviceId: Id<"groupDevices">) => {
      removeGroupDeviceMut({ groupDeviceId })
        .then(() => toast({ title: "Başarılı", description: "Cihaz gruptan çıkarıldı." }))
        .catch(() =>
          toast({ variant: "destructive", title: "Hata", description: "Cihaz gruptan çıkarılamadı." })
        );
    },
    isPending: false,
  };

  return { addGroupDevice, removeGroupDevice };
};
