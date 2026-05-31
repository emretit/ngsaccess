import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { ChevronRight, Building2, Cpu, HardDrive, Plus, Trash2, DoorClosed, DoorOpen, Loader2, ScanLine, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddDoorDialog } from "./AddDoorDialog";
import { EditReaderDialog } from "./EditReaderDialog";
import { toast } from "@/hooks/use-toast";

interface ZoneDoorTreeProps {
  onSelectDoor?: (doorId: string | null) => void;
  onSelectZone?: (zoneId: string | null) => void;
  onZoneAdded?: () => void;
}

// Tree veri tipleri (Convex query çıktısının kullandığımız alt kümesi).
type ZoneNode = { _id: Id<"zones">; name: string };
type DeviceNode = { _id: Id<"devices">; name: string; zoneId?: Id<"zones">; brand?: string };
type DoorNode = { _id: Id<"doors">; name: string; zoneId?: Id<"zones">; deviceId?: Id<"devices">; ioId?: number };

export const ZoneDoorTree = ({ onSelectDoor, onSelectZone, onZoneAdded }: ZoneDoorTreeProps) => {
  const zonesData = useQuery(api.zones.list, {});
  const doorsData = useQuery(api.doors.list, {});
  const devicesData = useQuery(api.devices.list, {});
  const readerStatusData = useQuery(api.doors.readerStatus, {});
  const isLoading = zonesData === undefined || doorsData === undefined || devicesData === undefined;
  const zones = (zonesData ?? []) as ZoneNode[];
  const doors = (doorsData ?? []) as DoorNode[];
  const devices = (devicesData ?? []) as DeviceNode[];
  const readerByDoor = new Map(
    (readerStatusData ?? []).map((r) => [String(r.doorId), r])
  );

  const removeZone = useMutation(api.zones.remove);
  const removeDoor = useMutation(api.doors.remove);
  const openIdeDoor = useAction(api.actions.ideGatewayDevice.openIdeDoor);

  const [selectedZone, setSelectedZone] = useState<Id<"zones"> | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<Id<"doors"> | null>(null);
  const [expandedZones, setExpandedZones] = useState<Id<"zones">[]>([]);
  const [expandedDevices, setExpandedDevices] = useState<Id<"devices">[]>([]);
  const [showAddDoorDialog, setShowAddDoorDialog] = useState(false);
  const [selectedZoneForDoor, setSelectedZoneForDoor] = useState<{ id: Id<"zones">; name: string } | null>(null);
  const [openingDoorId, setOpeningDoorId] = useState<Id<"doors"> | null>(null);
  const [editReader, setEditReader] = useState<{
    doorId: Id<"doors">;
    readerName: string;
    readerDirection: "entry" | "exit" | "both";
  } | null>(null);

  const handleOpenIdeDoor = async (deviceId: Id<"devices">, doorId: Id<"doors">) => {
    setOpeningDoorId(doorId);
    try {
      const res = await openIdeDoor({ deviceId, doorId });
      toast({
        title: res.ok ? (res.queued ? "Komut gönderildi" : "Kapı açıldı") : "Açılamadı",
        description: res.ok
          ? res.queued
            ? "Panel birkaç saniye içinde uygulayacak (MQTT)"
            : "Komut panele gönderildi"
          : res.error ?? "Bilinmeyen hata",
        variant: res.ok ? undefined : "destructive",
      });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Kapı açılırken hata oluştu",
        variant: "destructive",
      });
    } finally {
      setOpeningDoorId(null);
    }
  };

  const handleDeleteZone = async (zoneId: Id<"zones">) => {
    try {
      await removeZone({ zoneId });
      toast({ title: "Başarılı", description: "Bölge silindi" });
      onZoneAdded?.();
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Bölge silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDoor = async (doorId: Id<"doors">) => {
    try {
      await removeDoor({ doorId });
      toast({ title: "Başarılı", description: "Kapı silindi" });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Kapı silinirken bir hata oluştu",
        variant: "destructive",
      });
    }
  };

  const handleAddDoor = (zoneId: Id<"zones">, zoneName: string) => {
    setSelectedZoneForDoor({ id: zoneId, name: zoneName });
    setShowAddDoorDialog(true);
  };

  const toggleZone = (id: Id<"zones">) =>
    setExpandedZones((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]));
  const toggleDevice = (id: Id<"devices">) =>
    setExpandedDevices((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));

  // Okuyucu alt-satırı (kapının altında).
  const renderReader = (door: DoorNode) => {
    const reader = readerByDoor.get(String(door._id));
    if (!reader) return null;
    const dirLabel =
      reader.readerDirection === "exit"
        ? "Çıkış"
        : reader.readerDirection === "both"
          ? "Giriş/Çıkış"
          : "Giriş";
    const lastLabel = reader.lastReadAt
      ? new Date(reader.lastReadAt).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Istanbul",
        })
      : "—";
    return (
      <div className="group/reader flex items-center gap-2 rounded-md px-2 py-1 ml-12 text-xs text-muted-foreground hover:bg-accent/50">
        <ScanLine className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{reader.readerName}</span>
        <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
          {dirLabel}
        </Badge>
        <span className="ml-auto tabular-nums" title={reader.lastReadAt ? "Son okuma" : "Henüz okuma yok"}>
          {lastLabel}
        </span>
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            reader.online ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
          title={reader.online ? "Çevrimiçi" : "Çevrimdışı"}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 transition-opacity group-hover/reader:opacity-100"
          title="Okuyucuyu Düzenle"
          onClick={(e) => {
            e.stopPropagation();
            setEditReader({
              doorId: door._id,
              readerName: reader.readerName,
              readerDirection: reader.readerDirection,
            });
          }}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  // Tek bir kapı satırı (panel altında veya bölge altında manuel).
  const renderDoor = (door: DoorNode, panelDeviceId: Id<"devices"> | null) => (
    <li key={door._id}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md p-2 transition-all ml-6",
          "hover:bg-accent hover:text-accent-foreground",
          selectedDoor === door._id && "bg-accent/80 text-accent-foreground font-medium"
        )}
        onClick={() => {
          const next = door._id === selectedDoor ? null : door._id;
          setSelectedDoor(next);
          onSelectDoor?.(next);
        }}
      >
        <DoorClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{door.name}</span>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
          {panelDeviceId ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-emerald-100"
              title="Kapıyı Aç"
              disabled={openingDoorId === door._id}
              onClick={(e) => {
                e.stopPropagation();
                void handleOpenIdeDoor(panelDeviceId, door._id);
              }}
            >
              {openingDoorId === door._id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <DoorOpen className="h-3 w-3 text-emerald-600" />
              )}
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/80" onClick={(e) => { e.stopPropagation(); handleDeleteDoor(door._id); }}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {renderReader(door)}
    </li>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Yükleniyor...
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-xs text-muted-foreground">Bölge yok</p>
    );
  }

  return (
    <>
      <ul role="tree" className="space-y-0.5">
        {zones.map((zone) => {
          const isExpanded = expandedZones.includes(zone._id);
          const zoneDevices = devices.filter((d) => String(d.zoneId) === String(zone._id));
          // Cihaza bağlı olmayan manuel kapılar (door.deviceId yok) doğrudan bölge altında.
          const manualDoors = doors.filter(
            (door) => String(door.zoneId) === String(zone._id) && !door.deviceId
          );

          return (
            <li key={zone._id} role="treeitem" aria-expanded={isExpanded}>
              <div
                className={cn(
                  "group flex items-center gap-1 rounded-md p-2 transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedZone === zone._id && "bg-accent/80 text-accent-foreground font-medium"
                )}
                onClick={() => {
                  const next = zone._id === selectedZone ? null : zone._id;
                  setSelectedZone(next);
                  setSelectedDoor(null);
                  onSelectZone?.(next);
                }}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 hover:bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleZone(zone._id);
                  }}
                >
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200", isExpanded && "rotate-90")} />
                </Button>

                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm">{zone.name}</span>

                <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/80" title="Kapı ekle" onClick={(e) => { e.stopPropagation(); handleAddDoor(zone._id, zone.name); }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-accent/80" title="Bölgeyi sil" onClick={(e) => { e.stopPropagation(); handleDeleteZone(zone._id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <ul role="group" className={cn("overflow-hidden transition-all duration-200", isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
                {zoneDevices.length === 0 && manualDoors.length === 0 ? (
                  <li className="text-xs text-muted-foreground pl-8 py-2">Cihaz/kapı yok</li>
                ) : (
                  <>
                    {/* Cihazlar (panel) → altında kapıları */}
                    {zoneDevices.map((device) => {
                      const isPanel = device.brand === "ide_smart";
                      const deviceDoors = doors.filter((door) => String(door.deviceId) === String(device._id));
                      const devExpanded = expandedDevices.includes(device._id);
                      return (
                        <li key={device._id}>
                          <div
                            className={cn(
                              "group flex items-center gap-1 rounded-md p-2 transition-all ml-3",
                              "hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0 hover:bg-transparent"
                              onClick={(e) => { e.stopPropagation(); toggleDevice(device._id); }}
                            >
                              <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200", devExpanded && "rotate-90")} />
                            </Button>
                            {isPanel ? (
                              <Cpu className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1 truncate text-sm">{device.name}</span>
                            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                              {deviceDoors.length} kapı
                            </Badge>
                          </div>
                          <ul role="group" className={cn("overflow-hidden transition-all duration-200", devExpanded ? "max-h-[1500px] opacity-100" : "max-h-0 opacity-0")}>
                            {deviceDoors.length === 0 ? (
                              <li className="text-xs text-muted-foreground pl-12 py-1.5">Kapı yok</li>
                            ) : (
                              deviceDoors.map((door) => renderDoor(door, isPanel ? device._id : null))
                            )}
                          </ul>
                        </li>
                      );
                    })}

                    {/* Manuel kapılar (cihaza bağlı değil) */}
                    {manualDoors.map((door) => renderDoor(door, null))}
                  </>
                )}
              </ul>
            </li>
          );
        })}
      </ul>

      {selectedZoneForDoor && (
        <AddDoorDialog
          open={showAddDoorDialog}
          onOpenChange={setShowAddDoorDialog}
          onSuccess={() => {}}
          zoneId={selectedZoneForDoor.id}
          zoneName={selectedZoneForDoor.name}
        />
      )}

      {editReader && (
        <EditReaderDialog
          open={!!editReader}
          onOpenChange={(open) => { if (!open) setEditReader(null); }}
          doorId={editReader.doorId}
          readerName={editReader.readerName}
          readerDirection={editReader.readerDirection}
        />
      )}
    </>
  );
};
