import { useRef, useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UseFormReturn } from "react-hook-form";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useToast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { FormValues } from "../hooks/useDeviceFormSchema";
import { NEW_ZONE_VALUE } from "./DeviceZoneSection";
interface ZoneForForm {
  id: string;
  name: string;
}

interface DoorForForm {
  id: string;
  name: string;
  zone_id?: string;
}

interface DeviceLocationSectionProps {
  form: UseFormReturn<FormValues>;
  zones: ZoneForForm[];
  doors: DoorForForm[];
  locationLoading: boolean;
  selectedZoneId: string | undefined;
  filteredDoors: DoorForForm[];
  allowCreate?: boolean;
}

export function DeviceLocationSection({
  form,
  zones,
  locationLoading,
  filteredDoors,
  allowCreate = true,
}: DeviceLocationSectionProps) {
  const userChangedZone = useRef(false);
  const [zoneDialogOpen, setZoneDialogOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState("");
  const [isCreatingZone, setIsCreatingZone] = useState(false);
  const createZone = useMutation(api.zones.create);
  const { toast } = useToast();
  const { projectId } = useActiveProject();
  // Hikvision'da kapı sayısı modelden türetilir (DeviceHikvisionSection) → generic
  // "Kapı Sayısı" select'ini gizle. Diğer markalarda eski davranış korunur.
  const brand = form.watch("brand");
  const showDoorCount = brand !== "hikvision";

  const handleCreateZone = async () => {
    const trimmedName = newZoneName.trim();
    const deviceName = form.getValues("name").trim();
    if (!trimmedName) {
      toast({ title: "Hata", description: "Bölge adı gereklidir.", variant: "destructive" });
      return;
    }
    if (deviceName && trimmedName.toLocaleLowerCase("tr-TR") === deviceName.toLocaleLowerCase("tr-TR")) {
      toast({
        title: "Hata",
        description: "Bölge adı cihaz adıyla aynı olamaz.",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingZone(true);
    try {
      const zoneId = await createZone({
        name: trimmedName,
        projectId: projectId ?? undefined,
      });
      form.setValue("zone_id", zoneId, { shouldDirty: true, shouldValidate: true });
      form.setValue("new_zone_name", "");
      form.setValue("door_id", undefined);
      setNewZoneName("");
      setZoneDialogOpen(false);
      toast({ title: "Başarılı", description: "Bölge eklendi." });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: error instanceof Error ? error.message : "Bölge eklenirken hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingZone(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="zone_id"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Bölge</FormLabel>
            <Select
              value={field.value ?? ""}
              onValueChange={(value) => {
                if (!value) return;
                if (value === NEW_ZONE_VALUE) {
                  setZoneDialogOpen(true);
                  return;
                }

                userChangedZone.current = true;

                if (value !== field.value) {
                  field.onChange(value);
                  if (value !== NEW_ZONE_VALUE) form.setValue("new_zone_name", "");

                  if (userChangedZone.current) {
                    const currentDoorId = form.getValues("door_id");

                    if (currentDoorId) {
                      const doorBelongsToNewZone = filteredDoors.some(
                        (door) => String(door.id) === String(currentDoorId)
                      );

                      if (!doorBelongsToNewZone) {
                        form.setValue("door_id", undefined);
                      }
                    }
                  }
                }

                userChangedZone.current = false;
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder={locationLoading ? "Yükleniyor..." : "Bölge seçiniz"} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {zones.map((zone) => (
                  <SelectItem key={zone.id} value={String(zone.id)}>
                    {zone.name}
                  </SelectItem>
                ))}
                {allowCreate && (
                  <SelectItem value={NEW_ZONE_VALUE}>+ Yeni Bölge Ekle</SelectItem>
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <Dialog
        open={zoneDialogOpen}
        onOpenChange={(open) => {
          setZoneDialogOpen(open);
          if (!open) setNewZoneName("");
        }}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Yeni Bölge Ekle</DialogTitle>
            <DialogDescription>
              Cihazdan bağımsız bir bölge adı girin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <FormLabel htmlFor="new-device-zone-name">Bölge Adı</FormLabel>
              <Input
                id="new-device-zone-name"
                autoFocus
                placeholder="Örn. Ana Giriş"
                value={newZoneName}
                onChange={(event) => setNewZoneName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateZone();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setZoneDialogOpen(false)}
                disabled={isCreatingZone}
              >
                İptal
              </Button>
              <Button type="button" onClick={() => void handleCreateZone()} disabled={isCreatingZone}>
                {isCreatingZone ? "Ekleniyor..." : "Ekle"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {showDoorCount && (
        <FormField
          control={form.control}
          name="door_count"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kapı Sayısı</FormLabel>
              <Select
                value={field.value ? String(field.value) : ""}
                onValueChange={(value) => field.onChange(value ? Number(value) : undefined)}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Kapı sayısı seçiniz" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}
