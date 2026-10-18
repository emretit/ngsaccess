import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { notify } from "@/lib/notify";
import { Id } from "../../../convex/_generated/dataModel";

export const useGroupDeviceMutations = () => {

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
      notify.success("Başarılı", "Cihaz gruba eklendi.");
      return result;
    },
    mutate: (args: { groupId: Id<"accessRules">; deviceId: Id<"devices">; projectId?: Id<"projects"> }) => {
      addGroupDeviceMut(args)
        .then(() => notify.success("Başarılı", "Cihaz gruba eklendi."))
        .catch(() =>
          notify.error("Hata", "Cihaz gruba eklenemedi.")
        );
    },
    isPending: false,
  };

  const removeGroupDevice = {
    mutateAsync: async (groupDeviceId: Id<"groupDevices">) => {
      await removeGroupDeviceMut({ groupDeviceId });
      notify.success("Başarılı", "Cihaz gruptan çıkarıldı.");
    },
    mutate: (groupDeviceId: Id<"groupDevices">) => {
      removeGroupDeviceMut({ groupDeviceId })
        .then(() => notify.success("Başarılı", "Cihaz gruptan çıkarıldı."))
        .catch(() =>
          notify.error("Hata", "Cihaz gruptan çıkarılamadı.")
        );
    },
    isPending: false,
  };

  return { addGroupDevice, removeGroupDevice };
};
