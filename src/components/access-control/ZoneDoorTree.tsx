import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getHikModelSpec } from "../../../convex/lib/hikModels";

import { ArrowRightLeft, ChevronRight, Building2, Plus, Trash2, DoorClosed, DoorOpen, Loader2, ScanLine, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { Button } from "@/components/ui/button";
import { AddDoorDialog } from "./AddDoorDialog";
import { EditDoorDialog } from "./EditDoorDialog";
import { AddReaderDialog } from "./AddReaderDialog";
import { MoveReaderDialog } from "./MoveReaderDialog";
import { EditReaderDialog } from "./EditReaderDialog";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { notify } from "@/lib/notify";

interface ZoneDoorTreeProps {
  selectedZoneId: string | null;
  selectedDoorId: string | null;
  onSelectDoor?: (doorId: string | null) => void;
  onSelectZone?: (zoneId: string | null) => void;
  onZoneAdded?: () => void;
}

type ZoneNode = FunctionReturnType<typeof api.zones.list>[number];
type DeviceNode = FunctionReturnType<typeof api.devices.list>[number];
// readerStatus satırı (okuyucu başına) — kapı başına N satır dönebilir.
type ReaderRow = FunctionReturnType<typeof api.doors.readerStatus>[number];
type DoorNode = FunctionReturnType<typeof api.doors.list>[number];

export const ZoneDoorTree = ({ selectedZoneId: selectedZone, selectedDoorId: selectedDoor, onSelectDoor, onSelectZone, onZoneAdded }: ZoneDoorTreeProps) => {
  const { projectId, loading: projectLoading } = useActiveProjectScope();
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
  const zones = zonesData ?? [];
  const doors = doorsData ?? [];
  const devices = devicesData ?? [];
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

  const [expandedZones, setExpandedZones] = useState<Id<"zones">[]>([]);
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
      directions: ("entry" | "exit" | "both")[];
    }[];
  } | null>(null);
  const [addReader, setAddReader] = useState<{
    doorId: Id<"doors">;
    doorName: string;
    defaultDirection: "entry" | "exit" | "both";
  } | null>(null);
  const [editReader, setEditReader] = useState<{ door: DoorNode; reader: ReaderRow; isIdeDoor: boolean } | null>(null);
  const [editDoor, setEditDoor] = useState<{
    door: DoorNode;
    device: DeviceNode | undefined;
  } | null>(null);

  const [openTarget, setOpenTarget] = useState<{ deviceId: Id<"devices">; doorId: Id<"doors">; doorName: string; deviceName: string } | null>(null);
  const { run: sendOpen, pending: opening } = useAsyncAction(async () => {
    if (!openTarget) return;
    setOpeningDoorId(openTarget.doorId);
    try {
      const result = await openIdeDoor({ deviceId: openTarget.deviceId, doorId: openTarget.doorId });
      if (!result.ok) throw new Error(result.error ?? "Komut gönderilemedi");
      notify.success(result.queued ? "Komut sıraya alındı; cihaz onayı bekleniyor." : "Komut panele gönderildi", "Kapının fiziksel açılışı henüz doğrulanmadı.");
      setOpenTarget(null);
    } finally { setOpeningDoorId(null); }
  }, { error: "Kapı komutu gönderilemedi" });

  const handleFetchHikReaderCfg = async (readerId: Id<"readers">) => {
    setFetchingReaderCfgId(readerId);
    try {
      const result = await fetchHikReaderCfg({ readerId });
      if (result.ok && result.snapshot) {
        const summary = result.snapshot.summary;
        notify.success("Okuyucu ayarları alındı", `Hik #${summary.readerNo}${summary.templateNo !== undefined ? ` · Plan ${summary.templateNo}` : ""}`);
      } else {
        notify.error("Okuyucu ayarları alınamadı", result.error);
      }
    } catch (error: unknown) {
      notify.error("Okuyucu ayarları alınamadı", error);
    } finally {
      setFetchingReaderCfgId(null);
    }
  };

  const [deleteZone, setDeleteZone] = useState<ZoneNode | null>(null);
  const [deleteDoor, setDeleteDoor] = useState<DoorNode | null>(null);

  const handleAddDoor = (zoneId: Id<"zones">, zoneName: string) => {
    setSelectedZoneForDoor({ id: zoneId, name: zoneName });
    setShowAddDoorDialog(true);
  };

  const [deleteReader, setDeleteReader] = useState<{ id: Id<"readers">; name: string } | null>(null);
  const handleDeleteReader = async (readerId: Id<"readers">) => {
    await removeReader({ readerId });
    notify.success("Okuyucu silindi");
  };

  const toggleZone = (id: Id<"zones">) =>
    setExpandedZones((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]));

  const targetDoorsForMove = (door: DoorNode, device: DeviceNode | null) => {
    const scopeDoors = door.deviceId
      ? doors.filter((candidate) => candidate.deviceId === door.deviceId)
      : doors.filter((candidate) => !candidate.deviceId && candidate.zoneId === door.zoneId);
    return scopeDoors.map((candidate) => ({
      id: candidate._id,
      name: candidate.name,
      readerCount: readersByDoor.get(String(candidate._id))?.length ?? 0,
      maxReaders: maxReadersForDevice(device),
      directions: (readersByDoor.get(String(candidate._id)) ?? []).map(reader => reader.readerDirection),
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
        className="group/reader ml-2 sm:ml-10 flex flex-wrap min-h-8 items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent/50"
        title={technicalDetails.length > 0 ? technicalDetails.join(" · ") : undefined}
      >
        <ScanLine className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 break-all">
          {readerLabel}
          <span className="text-muted-foreground/70"> · {dirLabel}</span>
        </span>
        {reader.hikCardReaderAntiSneakEnabled === true && (
          <span className="rounded-sm status-warning-badge px-1.5 py-0.5 text-[10px] font-medium">
            APB
          </span>
        )}
        <span className="tabular-nums text-[11px]" title={reader.lastReadAt ? "Son okuma" : "Henüz okuma yok"}>
          {reader.lastReadAt ? lastLabel : ""}
        </span>
        <StatusBadge tone={reader.online ? "success" : "neutral"} className="text-[10px]">{reader.online ? "Çevrimiçi" : "Çevrimdışı"}</StatusBadge>
        <RowActions label={`${reader.readerName} okuyucu işlemleri`}>
          <DropdownMenuItem onSelect={() => setEditReader({ door, reader, isIdeDoor: panelDevice?.brand === "ide_smart" })}><Settings2 className="mr-2 h-4 w-4" />Düzenle</DropdownMenuItem>
          {reader.readerId && <DropdownMenuItem onSelect={() => setMoveReader({ readerId: reader.readerId as Id<"readers">, readerName: reader.readerName, currentDoorId: door._id, currentDirection: reader.readerDirection, targetDoors: targetDoorsForMove(door, panelDevice) })}><ArrowRightLeft className="mr-2 h-4 w-4" />Taşı</DropdownMenuItem>}
          {canFetchHikCfg && <DropdownMenuItem disabled={fetchingCfg} onSelect={() => { void handleFetchHikReaderCfg(reader.readerId as Id<"readers">); }}><Settings2 className="mr-2 h-4 w-4" />{fetchingCfg ? "Ayarlar okunuyor…" : "Cihaz ayarlarını oku"}</DropdownMenuItem>}
          {reader.readerId && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onSelect={() => setDeleteReader({ id: reader.readerId as Id<"readers">, name: `${door.name} / ${reader.readerName}` })}><Trash2 className="mr-2 h-4 w-4" />Sil</DropdownMenuItem></>}
        </RowActions>
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
        {readers.length === 0 && <p className="text-xs text-muted-foreground py-1">Bu kapıya okuyucu atanmamış.</p>}
        {readers.map((reader) => renderReaderRow(door, reader, device))}
        {canCreateReader && (
          <button
            type="button"
            className="ml-2 sm:ml-10 flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-xs text-muted-foreground hover:bg-accent/50"
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
          "group flex flex-wrap items-center rounded-md transition-colors motion-reduce:transition-none ml-6",
          "hover:bg-accent hover:text-accent-foreground",
          selectedDoor === door._id && "bg-accent/80 text-accent-foreground font-medium"
        )}
      >
        <button
          className="flex flex-1 items-center gap-1 p-2 text-left bg-transparent border-0 cursor-pointer text-current min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
          onClick={() => {
            const next = door._id === selectedDoor ? null : door._id;
            onSelectDoor?.(next);
          }}
        >
          <DoorClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 break-all text-sm">{door.name}{panelDevice && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{deviceDisplayName(panelDevice)}</span>}</span>
        </button>
        <div className="flex opacity-100 transition-opacity motion-reduce:transition-none group-hover:opacity-100 group-focus-within:opacity-100 pr-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${door.name} kapısını düzenle`}
            className="h-8 w-8 shrink-0 hover:bg-accent/80"
            title="Kapıyı Düzenle"
            onClick={() => setEditDoor({ door, device: panelDevice ?? undefined })}
          >
            <Settings2 className="h-3 w-3" />
          </Button>
          {panelDeviceId ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 hover:bg-accent"
              title="Kapıyı Aç"
              aria-label={`${door.name} kapısını aç`}
              disabled={opening || openingDoorId === door._id}
              onClick={() => setOpenTarget({ deviceId: panelDeviceId, doorId: door._id, doorName: door.name, deviceName: panelDevice ? deviceDisplayName(panelDevice) : "Cihaz" })}
            >
              {openingDoorId === door._id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <DoorOpen className="h-3 w-3 text-primary" />
              )}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`${door.name} kapısını sil`}
              className="h-8 w-8 shrink-0 hover:bg-accent/80"
              onClick={() => setDeleteDoor(door)}
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
      <SectionSkeleton rows={3} label="Bölge ve kapılar yükleniyor" />
    );
  }

  if (zones.length === 0) {
    return (
      <EmptyState title="Henüz bölge yok" description="Cihazları yerleştirmek için bir bölge ekleyin." className="py-6" />
    );
  }

  return (
    <>
      <AlertDialog open={openTarget !== null} onOpenChange={next => { if (!next && !opening) setOpenTarget(null); }}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Kapı komutu gönderilsin mi?</AlertDialogTitle><AlertDialogDescription>{openTarget?.deviceName} cihazındaki {openTarget?.doorName} kapısına açma komutu gönderilecek. Fiziksel açılış ayrıca doğrulanmalıdır.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={opening}>Vazgeç</AlertDialogCancel><Button disabled={opening} onClick={() => void sendOpen()}>{opening ? "Gönderiliyor…" : "Komutu gönder"}</Button></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <ConfirmDestructive
        open={deleteZone !== null}
        onOpenChange={(open) => { if (!open) setDeleteZone(null); }}
        title="Bölge silinsin mi?"
        objectName={deleteZone?.name ?? "Bölge"}
        effects={["Boş bölge kaldırılır. Kapı veya cihaz eklenmişse silme işlemi engellenir.", "Kart okuma geçmişi korunur."]}
        confirmLabel="Bölgeyi sil"
        onConfirm={async () => {
          if (!deleteZone) return;
          await removeZone({ zoneId: deleteZone._id });
          notify.success("Bölge silindi");
          if (selectedZone === deleteZone._id) {
            onSelectZone?.(null);
          }
          onZoneAdded?.();
        }}
      />
      <ConfirmDestructive
        open={deleteDoor !== null}
        onOpenChange={(open) => { if (!open) setDeleteDoor(null); }}
        title="Kapı silinsin mi?"
        objectName={deleteDoor?.name ?? "Kapı"}
        effects={[
          `Kapı ve bağlı ${deleteDoor ? readersByDoor.get(String(deleteDoor._id))?.length ?? 0 : 0} okuyucu silinir.`,
          "Erişim kuralları ve grup-kapı bağlantıları otomatik silinmez; kuralları ayrıca gözden geçirin.",
          "Cihazdaki erişim izinleri bu işlemle kaldırılmaz.",
          "Kart okuma geçmişi korunur.",
        ]}
        confirmLabel="Kapıyı ve okuyucularını sil"
        onConfirm={async () => {
          if (!deleteDoor) return;
          await removeDoor({ doorId: deleteDoor._id });
          notify.success("Kapı ve okuyucuları silindi");
          if (selectedDoor === deleteDoor._id) {
            onSelectDoor?.(null);
          }
        }}
      />
      <ConfirmDestructive open={deleteReader !== null} onOpenChange={(open) => { if (!open) setDeleteReader(null); }} title="Okuyucuyu sil" objectName={deleteReader?.name ?? "Okuyucu"} effects={["Okuyucunun kapı eşlemesi kaldırılır.", "Son okuyucuysa kaynak kapı okuyucusuz kalır; kart okuma geçmişi korunur."]} confirmLabel="Okuyucuyu sil" onConfirm={async () => { if (deleteReader) await handleDeleteReader(deleteReader.id); }} />
      <ul aria-label="Bölgeler, kapılar ve okuyucular" className="space-y-0.5">
        {zones.map((zone) => {
          const isExpanded = expandedZones.includes(zone._id);
          const zoneDevices = devices.filter((d) => String(d.zoneId) === String(zone._id));
          const zoneDoorCount = doors.filter((door) => door.zoneId === zone._id).length;
          const zoneBlocked = zoneDoorCount > 0 || zoneDevices.length > 0;
          const zoneDoors = doors.filter(door => String(door.zoneId) === String(zone._id));

          return (
            <li key={zone._id}>
              {/* Outer div = layout + hover/selected styling. Bölge adı <button> = seçim hedefi. */}
              <div
                className={cn(
                  "group flex flex-wrap items-center rounded-md transition-colors motion-reduce:transition-none",
                  "hover:bg-accent hover:text-accent-foreground",
                  selectedZone === zone._id && "bg-accent/80 text-accent-foreground font-medium"
                )}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 hover:bg-transparent ml-1"
                  aria-label={`${zone.name} bölgesini ${isExpanded ? "daralt" : "genişlet"}`}
                  aria-expanded={isExpanded}
                  onClick={() => toggleZone(zone._id)}
                >
                  <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 motion-reduce:transition-none", isExpanded && "rotate-90")} />
                </Button>

                <button
                  className="flex flex-1 items-center gap-1 py-2 pr-1 text-left bg-transparent border-0 cursor-pointer text-current min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                  onClick={() => {
                    const next = zone._id === selectedZone ? null : zone._id;
                    onSelectZone?.(next);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); if (!isExpanded) toggleZone(zone._id); }
                    if (e.key === "ArrowLeft")  { e.preventDefault(); if (isExpanded)  toggleZone(zone._id); }
                  }}
                >
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 break-words text-sm">{zone.name}</span>
                </button>

                <RowActions label={`${zone.name} bölge işlemleri`}>
                  <DropdownMenuItem onSelect={() => handleAddDoor(zone._id, zone.name)}><Plus className="mr-2 h-4 w-4" />Kapı ekle</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {zoneBlocked && <DropdownMenuLabel className="max-w-64 whitespace-normal text-xs font-normal text-muted-foreground">Önce {zoneDoorCount} kapıyı ve {zoneDevices.length} cihazı taşıyın veya silin.</DropdownMenuLabel>}
                  <DropdownMenuItem disabled={zoneBlocked} className="text-destructive" onSelect={() => setDeleteZone(zone)}><Trash2 className="mr-2 h-4 w-4" />Bölgeyi sil</DropdownMenuItem>
                </RowActions>
              </div>

              <ul hidden={!isExpanded}>
                {zoneDoors.length === 0 ? <li className="py-2 pl-8 text-xs text-muted-foreground">Bu bölgede kapı yok.</li> : zoneDoors.map(door => {
                  const owner = devices.find(device => device._id === door.deviceId) ?? null;
                  return renderDoor(door, owner?.brand === "ide_smart" ? owner._id : null, owner);
                })}
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

      {editReader && <EditReaderDialog open onOpenChange={open => { if (!open) setEditReader(null); }}
        readerId={editReader.reader.readerId} doorId={editReader.door._id}
        readerName={editReader.reader.readerName} readerDirection={editReader.reader.readerDirection}
        requireSensor={editReader.door.requireSensor} isIdeDoor={editReader.isIdeDoor} />}

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
