import { useEffect, useRef } from "react";
import type { ServerDevice } from "@/types/device";
/** Consume each URL request once; a delayed router update cannot reopen a closed panel. */
export function useDeviceDeepLink(
  requestedId: string | null,
  devices: ServerDevice[],
  loading: boolean,
  open: boolean,
  onOpen: (device: ServerDevice) => void,
  activeId?: string | null,
  onRestoreUrl?: (id: string | null) => void,
) {
  const handled = useRef<string | null>(null);
  useEffect(() => {
    // Açık formun kirli durumunu değiştirmeden URL'yi görünen cihaza geri eşitle.
    if (open) {
      if (activeId !== undefined && requestedId !== activeId) onRestoreUrl?.(activeId);
      return;
    }
    if (loading || handled.current === requestedId) return;
    const device = devices.find((candidate) => candidate._id === requestedId);
    // The list may still be loading a newly added device. Consume only actual opens.
    if (requestedId && !device) return;
    handled.current = requestedId;
    if (device) onOpen(device);
  }, [requestedId, devices, loading, open, onOpen, activeId, onRestoreUrl]);
  return (id: string | null) => {
    handled.current = id;
  };
}
