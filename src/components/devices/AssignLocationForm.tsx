import { useAsyncAction } from "@/hooks/useAsyncAction";

import { useState, useEffect } from "react";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormActions } from "@/components/shared/FormActions";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { ServerDevice } from "@/types/device";

interface AssignLocationFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (zoneId: string, doorId: string) => Promise<void>;
  deviceName: string;
  device?: ServerDevice;
}

export function AssignLocationForm({
  open,
  onClose,
  onSubmit,
  deviceName,
  device,
}: AssignLocationFormProps) {
  const isPanel =
    device?.brand === "ide_smart" || device?.brand === "hikvision";
  const { zones, doors, loading } = useZonesAndDoors();
  const [attempted, setAttempted] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>("");
  const [selectedDoorId, setSelectedDoorId] = useState<string>("");
  const [filteredDoors, setFilteredDoors] = useState<typeof doors>([]);

  useEffect(() => {
    if (open) setAttempted(false);
    if (open && device) {
      const zoneValue = device.zoneId ?? "";
      const doorValue = device.doorId ?? "";

      if (selectedZoneId !== zoneValue) {
        setSelectedZoneId(zoneValue);
      }
      if (selectedDoorId !== doorValue) {
        setSelectedDoorId(doorValue);
      }
    } else if (open && !device) {
      setSelectedZoneId("");
      setSelectedDoorId("");
    }
    // selectedZoneId/selectedDoorId deps'e eklenince loop oluşur — bilinçli olarak sadece prop'lara bağlı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device?.zoneId, device?.doorId]);

  useEffect(() => {
    if (selectedZoneId && doors.length > 0) {
      const filtered = doors.filter(
        (door) =>
          door.zoneId === selectedZoneId &&
          (!door.deviceId || door.deviceId === device?._id),
      );
      setFilteredDoors(filtered);

      if (
        selectedDoorId &&
        !filtered.some((door) => door._id === selectedDoorId)
      ) {
        setSelectedDoorId("");
      }
    } else {
      setFilteredDoors([]);
      if (selectedDoorId) {
        setSelectedDoorId("");
      }
    }
    // selectedDoorId yalnızca koşul kontrolünde okunur; deps'e eklenince gereksiz tekrar tetiklenir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedZoneId, doors]);

  const { run: assign, pending: isSubmitting } = useAsyncAction(
    async () => {
      if (!selectedZoneId || (!isPanel && !selectedDoorId))
        throw new Error("Lütfen bölge ve kapı seçin");
      await onSubmit(selectedZoneId, selectedDoorId);
      notify.success(`${deviceName} cihazının konumu güncellendi.`);
    },
    { error: "Konum atanamadı" },
  );
  const guard = useUnsavedChangesGuard(
    open &&
      (selectedZoneId !== (device?.zoneId ?? "") ||
        selectedDoorId !== (device?.doorId ?? "")),
  );
  const close = () => {
    if (!isSubmitting) guard.requestClose(onClose);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);
    if (!selectedZoneId || (!isPanel && !selectedDoorId)) {
      document.getElementById(!selectedZoneId ? "zone" : "door")?.focus();
      return;
    }
    if (await assign()) onClose();
  };

  return (
    <>
      <FormDialog
        open={open}
        onRequestClose={close}
        pending={isSubmitting}
        title={`${deviceName} — Konum Ata`}
        size="sm"
        onSubmit={handleSubmit}
        footer={
          <FormActions
            layout="dialog"
            isLoading={isSubmitting}
            onClose={close}
            cancelLabel="İptal"
            submitLabel="Konum Ata"
            busyLabel="Atanıyor..."
            submitDisabled={loading}
          />
        }
      >
        {attempted && (!selectedZoneId || (!isPanel && !selectedDoorId)) && (
          <p role="alert" className="text-sm text-destructive">
            Konum atanamadı. Bölge ve uygun kapıyı seçin.
          </p>
        )}
        <div className="grid gap-4 py-4">
          <FormFieldWrapper
            htmlFor="zone"
            label="Bölge"
            className="grid gap-2"
            error={attempted && !selectedZoneId ? "Bölge seçin." : undefined}
          >
            {(control) => (
              <Select
                value={selectedZoneId}
                onValueChange={setSelectedZoneId}
                disabled={loading || isSubmitting}
              >
                <SelectTrigger {...control}>
                  <SelectValue placeholder="Bölge seçin" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((zone) => (
                    <SelectItem key={zone._id} value={zone._id}>
                      {zone.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormFieldWrapper>
          {isPanel ? (
            <p className="text-sm text-muted-foreground">
              Panelin tüm kapıları ve okuyucuları seçilen bölgeye taşınır. Kapı
              eşlemesi değiştirilmez.
            </p>
          ) : (
            <FormFieldWrapper
              htmlFor="door"
              label="Kapı"
              className="grid gap-2"
              error={attempted && !selectedDoorId ? "Kapı seçin." : undefined}
            >
              {(control) => (
                <Select
                  value={selectedDoorId}
                  onValueChange={setSelectedDoorId}
                  disabled={!selectedZoneId || loading || isSubmitting}
                >
                  <SelectTrigger {...control}>
                    <SelectValue placeholder="Kapı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoors.map((door) => (
                      <SelectItem key={door._id} value={door._id}>
                        {door.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormFieldWrapper>
          )}
        </div>
      </FormDialog>
      {guard.dialog}
    </>
  );
}
