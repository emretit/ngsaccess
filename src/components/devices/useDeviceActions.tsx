import { notify } from "@/lib/notify";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
export function useDeviceActions() {
  const removeDevice = useMutation(api.devices.remove);
  const handleDeleteDevice = async (deviceId: string) => {
    await removeDevice({ deviceId: deviceId as Id<"devices"> });
    notify.success("Cihaz silindi");
  };
  return { handleDeleteDevice };
}
