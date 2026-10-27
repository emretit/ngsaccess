import { useListSelection } from "@/hooks/useListSelection";
import { useState } from "react";
import { Device } from "@/types/device";
import { notify } from "@/lib/notify";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function visibleSelection<T extends string>(selected: T[], visible: T[]): T[] {
  const ids = new Set(visible);
  return selected.filter((id) => ids.has(id));
}

export async function deleteDeviceSelection<T extends string>(targets: T[], remove: (id: T) => Promise<unknown>) {
  const results = await Promise.allSettled(targets.map(remove));
  const failed = targets.filter((_, index) => results[index].status === "rejected");
  return { failed, deleted: targets.length - failed.length };
}

export function useDeviceTable(devices: Device[]) {
  const [selection, setSelection] = useState<Id<"devices">[]>([]);
  const [previousIds, setPreviousIds] = useState("");
  const idsKey = devices.map((device) => `${device.projectId}:${device._id}`).sort().join(",");
  if (previousIds !== idsKey) {
    setPreviousIds(idsKey);
    setSelection(visibleSelection(selection, devices.map((device) => device._id)));
  }
  const selectedDevices = visibleSelection(selection, devices.map((device) => device._id));
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const removeDevice = useMutation(api.devices.remove);

  const selectionActions = useListSelection({
    visibleIds: devices.map(device => device._id),
    selected: new Set(selectedDevices),
    onChange: next => setSelection([...next]),
  });
  const handleSelectAll = selectionActions.selectAll;
  const handleSelectDevice = (checked: boolean, deviceId: Id<"devices">) => {
    if (checked !== selectedDevices.includes(deviceId)) selectionActions.toggle(deviceId);
  };
  const handleBulkDelete = async () => {
    const targets = visibleSelection(selectedDevices, devices.map((device) => device._id));
    const { failed, deleted } = await deleteDeviceSelection(targets, (deviceId) => removeDevice({ deviceId }));
    setSelection(failed);
    if (deleted) notify.success(`${deleted} cihaz silindi`);
    if (failed.length) throw new Error(`${failed.length} cihaz silinemedi. Yalnız bu cihazlar seçili kaldı; tekrar deneyebilirsiniz.`);
    setShowDeleteDialog(false);
  };
  return { checked: selectionActions.checked, selectedDevices, showDeleteDialog, setShowDeleteDialog, handleSelectAll, handleSelectDevice, handleBulkDelete };
}
