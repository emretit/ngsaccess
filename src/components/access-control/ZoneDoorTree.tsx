import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getHikModelSpec } from "../../../convex/lib/hikModels";

import { ArrowRightLeft, ChevronRight, Building2, Cpu, HardDrive, Plus, Trash2, DoorClosed, DoorOpen, Loader2, ScanLine, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddDoorDialog } from "./AddDoorDialog";
import { EditDoorDialog, type DoorForEdit } from "./EditDoorDialog";
import { AddReaderDialog } from "./AddReaderDialog";
import { MoveReaderDialog } from "./MoveReaderDialog";
import { toast } from "@/hooks/use-toast";
import { useActiveProject } from "@/contexts/ActiveProjectContext";

interface ZoneDoorTreeProps {
  onSelectDoor?: (doorId: string | null) => void;
  onSelectZone?: (zoneId: string | null) => void;
  onZoneAdded?: () => void;
}

// Tree veri tipleri (Convex query çıktısının kullandığımız alt kümesi).
type ZoneNode = { _id: Id<"zones">; name: string };
type DeviceNode = {
  _id: Id<"devices">;
  name: string;
  zoneId?: Id<"zones">;
  brand?: string;
  ideUuid?: string;
  hikTransport?: string;
  hikModel?: string;
};
// readerStatus satırı (okuyucu başına) — kapı başına N satır dönebilir.
type ReaderRow = FunctionReturnType<typeof api.doors.readerStatus>[number];
// DoorNode: EditDoorDialog'un DoorForEdit tipiyle uyumlu (ortak alanlar) +
// ağaç görüntüleme için gerekli ek alanlar.
type DoorNode = DoorForEdit & {
  zoneId?: Id<"zones">;
  deviceId?: Id<"devices">;
  ioId?: number;
  requireSensor?: boolean;
};

export const ZoneDoorTree = ({ onSelectDoor, onSelectZone, onZoneAdded }: ZoneDoorTreeProps) => {
  const { projectId, loading: projectLoading } = useActiveProject();
  const queryArgs = !projectLoading && projectId ? { projectId } : "skip";
  const zonesData = useQuery(api.zones.list, queryArgs);
  const doorsData = useQuery(api.doors.list, queryArgs);
  const devicesData = useQuery(api.devices.list, queryArgs);
  const readerStatusData = useQuery(api.doors.readerStatus, queryArgs);
  const isLoading =
    projectLoading ||
    (!!projectId &&
      (zonesData === undefined ||
        doorsData === undefined ||
        devicesData === undefined ||
        readerStatusData === undefined));
  const zones = (zonesData ?? []) as ZoneNode[];
  const doors = (doorsData ?? []) as DoorNode[];
  const devices = (devicesData ?? []) as DeviceNode[];
  // Okuyucuları kapı bazında grupla (kapı başına 1..2 okuyucu).
  const readersByDoor = new Map<string, ReaderRow[]>();
  for (const r of readerStatusData ?? []) {
    const k = String(r.doorId);
    const arr = readersByDoor.get(k);
    if (arr) arr.push(r);
    else readersByDoor.set(k, [r]);
  }

  const removeZone = useMutation(api.zones.remove);
  const removeDoor = useMutation(api.doors.remove);
  const removeReader = useMutation(api.readers.remove);
  const openIdeDoor = useAction(api.actions.ideGatewayDevice.openIdeDoor);
  const fetchHikReaderCfg = useAction(api.actions.hikGatewayDevice.fetchReaderCfg);

  // Kapı başına izin verilen en çok okuyucu — cihaz markası/modeline göre (UI tarafı; sunucu da doğrular).
  const maxReadersForDevice = (device: DeviceNode | null | undefined): number => {
    if (!device) return 2;
    if (device.brand === "ide_smart") return 1;
    if (device.brand === "hikvision") return getHikModelSpec(device.hikModel)?.maxReadersPerDoor ?? 2;
    return 2;
  };

  const readerCapacityForDevice = (device: DeviceNode | null | undefined, deviceDoors: DoorNode[]): number | null => {
    if (!device) return null;
    if (device.brand === "hikvision") {
      const spec = getHikModelSpec(device.hikModel);
      if (spec) return spec.doorCount * spec.defaultReadersPerDoor;
      return deviceDoors.length;
    }
    if (device.brand === "ide_smart") return deviceDoors.length;
    return null;
  };

  const countReadersForDevice = (deviceId: Id<"devices"> | undefined): number => {
    if (!deviceId) return 0;
    return (readerStatusData ?? []).filter((reader) => {
      const door = doors.find((item) => item._id === reader.doorId);
      return door?.deviceId === deviceId;
    }).length;
  };

  const [selectedZone, setSelectedZone] = useState<Id<"zones"> | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<Id<"doors"> | null>(null);
  const [expandedZones, setExpandedZones] = useState<Id<"zones">[]>([]);
  const [expandedDevices, setExpandedDevices] = useState<Id<"devices">[]>([]);
  const [showAddDoorDialog, setShowAddDoorDialog] = useState(false);
  const [selectedZoneForDoor, setSelectedZoneForDoor] = useState<{ id: Id<"zones">; name: string } | null>(null);
  const [openingDoorId, setOpeningDoorId] = useState<Id<"doors"> | null>(null);
  const [fetchingReaderCfgId, setFetchingReaderCfgId] = useState<Id<"readers"> | null>(null);
  const [moveReader, setMoveReader] = useState<{
    readerId: Id<"readers">;
    readerName: string;
    currentDoorId: Id<"doors">;
    currentDirection: "entry" | "exit" | "both";
    targetDoors: {
      id: Id<"doors">;
      name: string;
      readerCount: number;
      maxReaders: number;
    }[];
  } | null>(null);
  const [addReader, setAddReader] = useState<{
    doorId: Id<"doors">;
    doorName: string;
    defaultDirection: "entry" | "exit" | "both";
  } | null>(null);
  const [editDoor, setEditDoor] = useState<{
    door: DoorNode;
    device: DeviceNode | undefined;
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

  const handleFetchHikReaderCfg = async (readerId: Id<"readers">) => {
    setFetchingReaderCfgId(readerId);
    try {
      const result = await fetchHikReaderCfg({ readerId });
      if (result.ok && result.snapshot) {
        const summary = result.snapshot.summary;
        toast({
          title: "Okuyucu ayarları alındı",
          description: `Hik #${summary.readerNo}${summary.templateNo !== undefined ? ` · Plan ${summary.templateNo}` : ""}`,
        });
      } else {
        toast({
          title: "Okuyucu ayarları alınamadı",
          description: result.error ?? "Bilinmeyen hata",
          variant: "destructive",
        });
      }
    } finally {
      setFetchingReaderCfgId(null);
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

  const handleDeleteReader = async (readerId: Id<"readers">) => {
    try {
      await removeReader({ readerId });
      toast({ title: "Başarılı", description: "Okuyucu silindi" });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Okuyucu silinirken hata oluştu",
        variant: "destructive",
      });
    }
  };

  const toggleZone = (id: Id<"zones">) =>
    setExpandedZones((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]));
  const toggleDevice = (id: Id<"devices">) =>
    setExpandedDevices((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));

  const targetDoorsForMove = (door: DoorNode, device: DeviceNode | null) => {
    const scopeDoors = door.deviceId
      ? doors.filter((candidate) => candidate.deviceId === door.deviceId)
      : doors.filter((candidate) => !candidate.deviceId && candidate.zoneId === door.zoneId);
    return scopeDoors.map((candidate) => ({
      id: candidate._id,
      name: candidate.name,
      readerCount: readersByDoor.get(String(candidate._id))?.length ?? 0,
      maxReaders: maxReadersForDevice(device),
    }));
  };

  // Tek okuyucu alt-satırı (kapının altında).
  const renderReaderRow = (
    door: DoorNode,
    reader: ReaderRow,
    panelDevice: DeviceNode | null,
  ) => {
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
    const canFetchHikCfg =
      !!reader.readerId &&
      panelDevice?.brand === "hikvision" &&
      panelDevice.hikTransport === "gateway";
    const fetchingCfg = !!reader.readerId && fetchingReaderCfgId === reader.readerId;
    const technicalDetails = [
      reader.hikReaderNo !== null ? `Hik okuyucu #${reader.hikReaderNo}` : null,
      reader.hikCardReaderPlanTemplateNo !== null
        ? `Plan ${reader.hikCardReaderPlanTemplateNo}`
        : null,
      reader.hikCardReaderAntiSneakEnabled !== null
        ? `APB ${reader.hikCardReaderAntiSneakEnabled ? "açık" : "kapalı"}`
        : null,
      reader.hikLastCfgAt
        ? `Cfg ${new Date(reader.hikLastCfgAt).toLocaleString("tr-TR", {
            timeZone: "Europe/Istanbul",
          })}`
        : null,
    ].filter((item): item is string => item !== null);
    const readerLabel = reader.readerName !== door.name ? reader.readerName : "Okuyucu";
    return (
      <div
        key={reader.readerId ?? `legacy-${door._id}`}
        className="group/reader ml-10 flex min-h-7 items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
        title={technicalDetails.length > 0 ? technicalDetails.join(" · ") : undefined}
      >
        <ScanLine className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">
          {readerLabel}
          <span className="text-muted-foreground/70"> · {dirLabel}</span>
        </span>
        {reader.hikCardReaderAntiSneakEnabled === true && (
          <span className="rounded-sm bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            APB
          </span>
        )}
        <span className="tabular-nums text-[11px]" title={reader.lastReadAt ? "Son okuma" : "Henüz okuma yok"}>
          {reader.lastReadAt ? lastLabel : ""}
        </span>
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            reader.online ? "bg-emerald-500" : "bg-muted-foreground/40"
          )}
          title={reader.online ? "Çevrimiçi" : "Çevrimdışı"}
        />
        {reader.readerId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 transition-opacity group-hover/reader:opacity-100"
            title="Okuyucuyu Taşı"
            aria-label="Okuyucuyu Taşı"
            onClick={() => {
              setMoveReader({
                readerId: reader.readerId as Id<"readers">,
                readerName: reader.readerName,
                currentDoorId: door._id,
                currentDirection: reader.readerDirection,
                targetDoors: targetDoorsForMove(door, panelDevice),
              });
            }}
          >
            <ArrowRightLeft className="h-3 w-3" />
          </Button>
        )}
        {canFetchHikCfg && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 transition-opacity group-hover/reader:opacity-100 hover:bg-accent/80"
            title="Hikvision Okuyucu Ayarlarını Oku"
            aria-label="Hikvision Okuyucu Ayarlarını Oku"
            disabled={fetchingCfg}
            onClick={(event) => {
              event.stopPropagation();
              void handleFetchHikReaderCfg(reader.readerId as Id<"readers">);
            }}
          >
            {fetchingCfg ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Settings2 className="h-3 w-3" />
            )}
          </Button>
        )}
        {reader.readerId && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 opacity-0 transition-opacity group-hover/reader:opacity-100 hover:bg-accent/80"
            title="Okuyucuyu Sil"
            aria-label="Okuyucuyu Sil"
            onClick={() => handleDeleteReader(reader.readerId as Id<"readers">)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  };

  // Kapının okuyucuları + "okuyucu ekle" satırı (kapı başına 1..max okuyucu).
  const renderReaders = (door: DoorNode, device: DeviceNode | null) => {
    const readers = readersByDoor.get(String(door._id)) ?? [];
    const max = maxReadersForDevice(device);
    const hasEntry = readers.some((r) => r.readerDirection === "entry");
    const deviceDoors = device
      ? doors.filter((candidate) => candidate.deviceId === device._id)
      : [];
    const deviceCapacity = readerCapacityForDevice(device, deviceDoors);
    const canCreateReader =
      readers.length < max &&
      (deviceCapacity === null || !device?._id || countReadersForDevice(device._id) < deviceCapacity);
    return (
      <>
        {readers.map((reader) => renderReaderRow(door, reader, device))}
        {canCreateReader && (
          <button
            type="button"
            className="ml-10 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
            onClick={() =>
              setAddReader({
                doorId: door._id,
                doorName: door.name,
                defaultDirection: hasEntry ? "exit" : "entry",
              })
            }
          >
            <Plus className="h-3 w-3" />
            Okuyucu
          </button>
        )}
      </>
    );
  };

  // Tek bir kapı satırı (panel altında veya bölge altında manuel).
  // Outer div = layout + hover/selected styling. Inner <button> = klavye/fare seçim hedefi.
  // Action butonlar sibling — iç içe interactive element ARIA ihlali yok.
  const renderDoor = (door: DoorNode, panelDeviceId: Id<"devices"> | null, panelDevice: DeviceNode | null) => (
    <li key={door._id} className="group/door">
      <div
        className={cn(
          "group flex items-center rounded-md transition-all ml-6",
          "hover:bg-accent hover:text-accent-foreground",
          selectedDoor === door._id && "bg-accent/80 text-accent-foreground font-medium"
        )}
      >
        <button
          className="flex flex-1 items-center gap-1 p-2 text-left bg-transparent border-0 cursor-pointer text-current min-w-0"
          onClick={() => {
            const next = door._id === selectedDoor ? null : door._id;
            setSelectedDoor(next);
            onSelectDoor?.(next);
          }}
        >
          <DoorClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-sm">{door.name}</span>
        </button>
        <div className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pr-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Kapıyı düzenle"
            className="h-6 w-6 hover:bg-accent/80"
            title="Kapıyı Düzenle"
            onClick={() => setEditDoor({ door, device: panelDevice ?? undefined })}
          >
            <Settings2 className="h-3 w-3" />
          </Button>
          {panelDeviceId ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:bg-emerald-100"
              title="Kapıyı Aç"
              disabled={openingDoorId === door._id}
              onClick={() => void handleOpenIdeDoor(panelDeviceId, door._id)}
            >
              {openingDoorId === door._id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <DoorOpen className="h-3 w-3 text-emerald-600" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Kapıyı sil"
              className="h-6 w-6 hover:bg-accent/80"
              onClick={() => handleDeleteDoor(door._id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {renderReaders(door, panelDevice)}
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
          const manualDoors = doors.filter(
            (door) => String(door.zoneId) === String(zone._id) && !door.deviceId
          );

          return (
            <li key={zone._id} role="treeitem" aria-expanded={isExpanded}>
              {/* Outer div = layout + hover/selected styling. Bölge adı <button> = seçim hedefi. */}
              <div
                className={cn(
                  "group flex items-center rounded-md transition-all",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedZone === zone._id && "bg-accent/80 text-accent-foreground font-medium"
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-7 shrink-0 hover:bg-transparent ml-1"
                  onClick={() => toggleZone(zone._id)}
                >
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200", isExpanded && "rotate-90")} />
                </Button>

                <button
                  className="flex flex-1 items-center gap-1 py-2 pr-1 text-left bg-transparent border-0 cursor-pointer text-current min-w-0"
                  onClick={() => {
                    const next = zone._id === selectedZone ? null : zone._id;
                    setSelectedZone(next);
                    setSelectedDoor(null);
                    onSelectZone?.(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); if (!isExpanded) toggleZone(zone._id); }
                    if (e.key === "ArrowLeft")  { e.preventDefault(); if (isExpanded)  toggleZone(zone._id); }
                  }}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">{zone.name}</span>
                </button>

                <div className="flex opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pr-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-accent/80"
                    title="Kapı ekle"
                    aria-label="Kapı ekle"
                    onClick={() => handleAddDoor(zone._id, zone.name)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-accent/80"
                    title="Bölgeyi sil"
                    aria-label="Bölgeyi sil"
                    onClick={() => handleDeleteZone(zone._id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <ul role="group" className={cn("overflow-hidden transition-all duration-200", isExpanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
                {zoneDevices.length === 0 && manualDoors.length === 0 ? (
                  <li className="text-xs text-muted-foreground pl-8 py-2">Cihaz/kapı yok</li>
                ) : (
                  <>
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
                              onClick={() => toggleDevice(device._id)}
                            >
                              <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200", devExpanded && "rotate-90")} />
                            </Button>
                            {isPanel ? (
                              <Cpu className="h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <HardDrive className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1 truncate text-sm">{deviceDisplayName(device)}</span>
                            <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                              {deviceDoors.length} kapı
                            </Badge>
                          </div>
                          <ul role="group" className={cn("overflow-hidden transition-all duration-200", devExpanded ? "max-h-[1500px] opacity-100" : "max-h-0 opacity-0")}>
                            {deviceDoors.length === 0 ? (
                              <li className="text-xs text-muted-foreground pl-12 py-1.5">Kapı yok</li>
                            ) : (
                              deviceDoors.map((door) => renderDoor(door, isPanel ? device._id : null, device))
                            )}
                          </ul>
                        </li>
                      );
                    })}

                    {manualDoors.map((door) => renderDoor(door, null, null))}
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

      {addReader && (
        <AddReaderDialog
          open={!!addReader}
          onOpenChange={(open) => { if (!open) setAddReader(null); }}
          doorId={addReader.doorId}
          doorName={addReader.doorName}
          defaultDirection={addReader.defaultDirection}
        />
      )}

      {moveReader && (
        <MoveReaderDialog
          open={!!moveReader}
          onOpenChange={(open) => { if (!open) setMoveReader(null); }}
          readerId={moveReader.readerId}
          readerName={moveReader.readerName}
          currentDoorId={moveReader.currentDoorId}
          currentDirection={moveReader.currentDirection}
          targetDoors={moveReader.targetDoors}
        />
      )}

      {editDoor && (
        <EditDoorDialog
          open={!!editDoor}
          onOpenChange={(open) => { if (!open) setEditDoor(null); }}
          onSuccess={() => {}}
          door={editDoor.door}
          device={editDoor.device}
        />
      )}
    </>
  );
};
