import { useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ChevronRight, Cpu, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { RowActions } from "@/components/shared/RowActions";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { AddZoneDialog } from "@/components/access-control/AddZoneDialog";
import { AddDoorDialog } from "@/components/access-control/AddDoorDialog";
import { EditDoorDialog } from "@/components/access-control/EditDoorDialog";
import { AddReaderDialog } from "@/components/access-control/AddReaderDialog";
import { EditReaderDialog } from "@/components/access-control/EditReaderDialog";
import { MoveReaderDialog } from "@/components/access-control/MoveReaderDialog";
import {
  TREE_NAME_BUTTON,
  TREE_ROW_ACTIONS,
  TREE_TOGGLE_BUTTON,
  TreePanel,
  TreePanelHeader,
  treeFixedItemClass,
} from "@/components/shared/TreePanel";
import { LocationDoorItem, type DeviceNode, type DoorAction, type DoorNode, type ReaderRow } from "./LocationDoorItem";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getHikModelSpec } from "../../../convex/lib/hikModels";

type ZoneNode = FunctionReturnType<typeof api.zones.list>[number];

type Dialog =
  | Exclude<DoorAction, { type: "fetchReaderCfg" }>
  | { type: "addDoor"; zone: ZoneNode }
  | { type: "deleteZone"; zone: ZoneNode };

/** Kapı başına izin verilen en çok okuyucu — cihaz markası/modeline göre (sunucu da doğrular). */
function maxReadersForDevice(device: DeviceNode | null): number {
  if (device?.brand === "ide_smart") return 1;
  if (device?.brand === "hikvision") return getHikModelSpec(device.hikModel)?.maxReadersPerDoor ?? 2;
  return 2;
}

/** Panelin toplam okuyucu kapasitesi; bilinmiyorsa null. */
function readerCapacityForDevice(device: DeviceNode | null, deviceDoorCount: number): number | null {
  if (device?.brand === "hikvision") {
    const spec = getHikModelSpec(device.hikModel);
    return spec ? spec.doorCount * spec.defaultReadersPerDoor : deviceDoorCount;
  }
  if (device?.brand === "ide_smart") return deviceDoorCount;
  return null;
}

interface LocationTreeProps {
  selectedZoneId: string | null;
  selectedDoorId: string | null;
  onSelectZone: (zoneId: string | null) => void;
  onSelectDoor: (doorId: string | null) => void;
  /** Bölge, kapı ve okuyucu yönetimi (ekle, düzenle, aç, sil) yalnız admin'e. */
  canManage?: boolean;
}

/** Cihazlar sayfasının sol paneli: Bölge → Kapı → Okuyucu; filtre ve konum yönetimi. */
export function LocationTree({
  selectedZoneId,
  selectedDoorId,
  onSelectZone,
  onSelectDoor,
  canManage = false,
}: LocationTreeProps) {
  const { projectId, loading: projectLoading } = useActiveProjectScope();
  const queryArgs = !projectLoading && projectId ? { projectId } : "skip";
  const zonesData = useQuery(api.zones.list, queryArgs);
  const doorsData = useQuery(api.doors.list, queryArgs);
  const devicesData = useQuery(api.devices.list, queryArgs);
  const [collapsedZones, setCollapsedZones] = useState<Set<string>>(() => new Set());
  const [expandedDoors, setExpandedDoors] = useState<Set<string>>(() => new Set());
  // Okuyucu durumu son kart okumasını izler; yalnız bir kapı açıkken abone olunur.
  const readerStatus = useQuery(api.doors.readerStatus, expandedDoors.size > 0 ? queryArgs : "skip");
  const [addZoneOpen, setAddZoneOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [fetchingReaderId, setFetchingReaderId] = useState<string | null>(null);

  const removeZone = useMutation(api.zones.remove);
  const removeDoor = useMutation(api.doors.remove);
  const removeReader = useMutation(api.readers.remove);
  const openIdeDoor = useAction(api.actions.ideGatewayDevice.openIdeDoor);
  const fetchHikReaderCfg = useAction(api.actions.hikGatewayDevice.fetchReaderCfg);

  const zones = zonesData ?? [];
  const doors = useMemo(() => doorsData ?? [], [doorsData]);
  const devices = useMemo(() => devicesData ?? [], [devicesData]);
  const deviceById = useMemo(() => new Map(devices.map((device) => [String(device._id), device])), [devices]);
  const doorsByZone = useMemo(() => {
    const map = new Map<string, DoorNode[]>();
    for (const door of doors) {
      if (!door.zoneId) continue;
      map.set(door.zoneId, [...(map.get(door.zoneId) ?? []), door]);
    }
    return map;
  }, [doors]);
  const readersByDoor = useMemo(() => {
    const map = new Map<string, ReaderRow[]>();
    for (const reader of readerStatus ?? []) {
      const key = String(reader.doorId);
      map.set(key, [...(map.get(key) ?? []), reader]);
    }
    return map;
  }, [readerStatus]);

  const deviceOf = (door: DoorNode) => (door.deviceId ? deviceById.get(String(door.deviceId)) ?? null : null);
  const readersOf = (door: DoorNode) => readersByDoor.get(String(door._id)) ?? [];
  const canAddReader = (door: DoorNode) => {
    const device = deviceOf(door);
    if (readersOf(door).length >= maxReadersForDevice(device)) return false;
    if (!device) return true;
    const deviceDoors = doors.filter((candidate) => candidate.deviceId === device._id);
    const capacity = readerCapacityForDevice(device, deviceDoors.length);
    const used = deviceDoors.reduce((sum, candidate) => sum + readersOf(candidate).length, 0);
    return capacity === null || used < capacity;
  };
  /** Okuyucu aynı paneldeki (panelsiz kapıda aynı bölgedeki) kapılara taşınabilir. */
  const moveTargets = (door: DoorNode) => {
    const maxReaders = maxReadersForDevice(deviceOf(door));
    return doors
      .filter((candidate) => (door.deviceId ? candidate.deviceId === door.deviceId : !candidate.deviceId && candidate.zoneId === door.zoneId))
      .map((candidate) => ({
        id: candidate._id,
        name: candidate.name,
        readerCount: readersOf(candidate).length,
        maxReaders,
        directions: readersOf(candidate).map((reader) => reader.readerDirection),
      }));
  };

  const fetchReaderCfg = async (readerId: Id<"readers">) => {
    setFetchingReaderId(readerId);
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
      setFetchingReaderId(null);
    }
  };

  const handleDoorAction = (action: DoorAction) => {
    if (action.type !== "fetchReaderCfg") setDialog(action);
    else if (action.reader.readerId) void fetchReaderCfg(action.reader.readerId);
  };

  const openDoorTarget = dialog?.type === "openDoor" ? dialog.door : null;
  const openDoorDevice = openDoorTarget ? deviceOf(openDoorTarget) : null;
  const { run: sendOpen, pending: opening } = useAsyncAction(async () => {
    if (!openDoorTarget?.deviceId) return;
    const result = await openIdeDoor({ deviceId: openDoorTarget.deviceId, doorId: openDoorTarget._id });
    if (!result.ok) throw new Error(result.error ?? "Komut gönderilemedi");
    notify.success(result.queued ? "Komut sıraya alındı; cihaz onayı bekleniyor." : "Komut panele gönderildi", "Kapının fiziksel açılışı henüz doğrulanmadı.");
    setDialog(null);
  }, { error: "Kapı komutu gönderilemedi" });

  const toggleIn = (setter: typeof setCollapsedZones, id: string) =>
    setter((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const closeDialog = (open: boolean) => { if (!open) setDialog(null); };

  const selectedDoor = doors.find((door) => door._id === selectedDoorId);
  const selectedZone = zones.find((zone) => zone._id === (selectedDoor?.zoneId ?? selectedZoneId));
  const deleteDoor = dialog?.type === "deleteDoor" ? dialog.door : null;
  const deleteZone = dialog?.type === "deleteZone" ? dialog.zone : null;
  const deleteReader = dialog?.type === "deleteReader" ? dialog : null;

  return (
    <>
      <TreePanel
        id="device-locations"
        label="Bölgeler"
        summary={selectedDoor ? `${selectedZone?.name ?? "Bölge"} / ${selectedDoor.name}` : (selectedZone?.name ?? "Tüm cihazlar")}
        header={
          <TreePanelHeader
            title="Bölgeler ve kapılar"
            addLabel="Bölge ekle"
            onAddClick={canManage ? () => setAddZoneOpen(true) : undefined}
          />
        }
      >
        <ul className="space-y-0.5">
          <li>
            <button
              type="button"
              className={treeFixedItemClass}
              aria-pressed={!selectedZoneId && !selectedDoorId}
              onClick={() => onSelectZone(null)}
            >
              <Cpu aria-hidden="true" className="mx-[3px] h-3.5 w-3.5 shrink-0" />
              Tüm cihazlar
            </button>
          </li>
        </ul>
        <div role="presentation" className="border-t" />
        {zonesData === undefined ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">Yükleniyor…</p>
        ) : zones.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Henüz bölge yok.{canManage ? " Eklemek için + düğmesini kullanın." : ""}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {zones.map((zone) => {
              const zoneDoors = doorsByZone.get(zone._id) ?? [];
              const zoneDeviceCount = devices.filter((device) => device.zoneId === zone._id).length;
              const zoneBlocked = zoneDoors.length > 0 || zoneDeviceCount > 0;
              const expanded = !collapsedZones.has(zone._id);
              const zoneSelected = selectedZoneId === zone._id && !selectedDoorId;
              const listId = `device-zone-${zone._id}`;
              return (
                <li key={zone._id}>
                  <div className={cn("group flex min-w-0 items-center rounded-sm", zoneSelected ? "bg-selected text-primary" : "hover:bg-muted")}>
                    {/* Ok yeri her satırda ayrılır; kapısı olan ve olmayan bölgelerin adları hizalı kalır. */}
                    {zoneDoors.length ? (
                      <button
                        type="button"
                        className={TREE_TOGGLE_BUTTON}
                        aria-label={`${zone.name} kapıları`}
                        aria-expanded={expanded}
                        aria-controls={listId}
                        onClick={() => toggleIn(setCollapsedZones, zone._id)}
                      >
                        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
                      </button>
                    ) : (
                      <span aria-hidden="true" className="w-5 shrink-0" />
                    )}
                    <button
                      type="button"
                      className={cn(TREE_NAME_BUTTON, zoneSelected && "font-medium")}
                      aria-pressed={zoneSelected}
                      onClick={() => onSelectZone(zone._id)}
                    >
                      {zone.name}
                    </button>
                    {canManage && (
                      <div className={TREE_ROW_ACTIONS}>
                        <RowActions label={`${zone.name} bölge işlemleri`}>
                          <DropdownMenuItem onSelect={() => setDialog({ type: "addDoor", zone })}>
                            <Plus className="mr-2 h-4 w-4" />Kapı ekle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {zoneBlocked && (
                            <DropdownMenuLabel className="max-w-64 whitespace-normal text-xs font-normal text-muted-foreground">
                              Önce {zoneDoors.length} kapıyı ve {zoneDeviceCount} cihazı taşıyın veya silin.
                            </DropdownMenuLabel>
                          )}
                          <DropdownMenuItem disabled={zoneBlocked} className="text-destructive" onSelect={() => setDialog({ type: "deleteZone", zone })}>
                            <Trash2 className="mr-2 h-4 w-4" />Bölgeyi sil
                          </DropdownMenuItem>
                        </RowActions>
                      </div>
                    )}
                  </div>
                  {zoneDoors.length > 0 && (
                    <ul id={listId} hidden={!expanded} className="ml-2.5 space-y-0.5 border-l pl-0.5">
                      {zoneDoors.map((door) => (
                        <LocationDoorItem
                          key={door._id}
                          door={door}
                          device={deviceOf(door)}
                          selected={selectedDoorId === door._id}
                          expanded={expandedDoors.has(door._id)}
                          onToggle={() => toggleIn(setExpandedDoors, door._id)}
                          onSelect={() => onSelectDoor(door._id)}
                          readers={readerStatus === undefined ? undefined : readersOf(door)}
                          canAddReader={readerStatus !== undefined && canAddReader(door)}
                          fetchingReaderId={fetchingReaderId}
                          onAction={canManage ? handleDoorAction : undefined}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </TreePanel>

      {canManage && (
        <>
          <AddZoneDialog open={addZoneOpen} onOpenChange={setAddZoneOpen} onSuccess={() => setAddZoneOpen(false)} />
          {dialog?.type === "addDoor" && (
            <AddDoorDialog open onOpenChange={closeDialog} onSuccess={() => {}} zoneId={dialog.zone._id} zoneName={dialog.zone.name} />
          )}
          {dialog?.type === "editDoor" && (
            <EditDoorDialog open onOpenChange={closeDialog} onSuccess={() => {}} door={dialog.door} device={deviceOf(dialog.door) ?? undefined} />
          )}
          {dialog?.type === "addReader" && (
            <AddReaderDialog
              open
              onOpenChange={closeDialog}
              doorId={dialog.door._id}
              doorName={dialog.door.name}
              defaultDirection={readersOf(dialog.door).some((reader) => reader.readerDirection === "entry") ? "exit" : "entry"}
            />
          )}
          {dialog?.type === "editReader" && (
            <EditReaderDialog
              open
              onOpenChange={closeDialog}
              readerId={dialog.reader.readerId}
              doorId={dialog.door._id}
              readerName={dialog.reader.readerName}
              readerDirection={dialog.reader.readerDirection}
              requireSensor={dialog.door.requireSensor}
              isIdeDoor={deviceOf(dialog.door)?.brand === "ide_smart"}
            />
          )}
          {dialog?.type === "moveReader" && dialog.reader.readerId && (
            <MoveReaderDialog
              open
              onOpenChange={closeDialog}
              readerId={dialog.reader.readerId}
              readerName={dialog.reader.readerName}
              currentDoorId={dialog.door._id}
              currentDirection={dialog.reader.readerDirection}
              targetDoors={moveTargets(dialog.door)}
            />
          )}
          <AlertDialog open={openDoorTarget !== null} onOpenChange={(open) => { if (!open && !opening) setDialog(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Kapı komutu gönderilsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  {openDoorDevice ? deviceDisplayName(openDoorDevice) : "Cihaz"} cihazındaki {openDoorTarget?.name} kapısına açma komutu gönderilecek. Fiziksel açılış ayrıca doğrulanmalıdır.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={opening}>Vazgeç</AlertDialogCancel>
                <Button disabled={opening} onClick={() => void sendOpen()}>{opening ? "Gönderiliyor…" : "Komutu gönder"}</Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <ConfirmDestructive
            open={deleteZone !== null}
            onOpenChange={closeDialog}
            title="Bölge silinsin mi?"
            objectName={deleteZone?.name ?? "Bölge"}
            effects={["Boş bölge kaldırılır. Kapı veya cihaz eklenmişse silme işlemi engellenir.", "Kart okuma geçmişi korunur."]}
            confirmLabel="Bölgeyi sil"
            onConfirm={async () => {
              if (!deleteZone) return;
              await removeZone({ zoneId: deleteZone._id });
              notify.success("Bölge silindi");
              if (selectedZoneId === deleteZone._id) onSelectZone(null);
            }}
          />
          <ConfirmDestructive
            open={deleteDoor !== null}
            onOpenChange={closeDialog}
            title="Kapı silinsin mi?"
            objectName={deleteDoor?.name ?? "Kapı"}
            effects={[
              `Kapı ve bağlı ${deleteDoor ? readersOf(deleteDoor).length : 0} okuyucu silinir.`,
              "Erişim kuralları ve grup-kapı bağlantıları otomatik silinmez; kuralları ayrıca gözden geçirin.",
              "Cihazdaki erişim izinleri bu işlemle kaldırılmaz.",
              "Kart okuma geçmişi korunur.",
            ]}
            confirmLabel="Kapıyı ve okuyucularını sil"
            onConfirm={async () => {
              if (!deleteDoor) return;
              await removeDoor({ doorId: deleteDoor._id });
              notify.success("Kapı ve okuyucuları silindi");
              if (selectedDoorId === deleteDoor._id) onSelectDoor(null);
            }}
          />
          <ConfirmDestructive
            open={deleteReader !== null}
            onOpenChange={closeDialog}
            title="Okuyucuyu sil"
            objectName={deleteReader ? `${deleteReader.door.name} / ${deleteReader.reader.readerName}` : "Okuyucu"}
            effects={["Okuyucunun kapı eşlemesi kaldırılır.", "Son okuyucuysa kaynak kapı okuyucusuz kalır; kart okuma geçmişi korunur."]}
            confirmLabel="Okuyucuyu sil"
            onConfirm={async () => {
              if (!deleteReader?.reader.readerId) return;
              await removeReader({ readerId: deleteReader.reader.readerId });
              notify.success("Okuyucu silindi");
            }}
          />
        </>
      )}
    </>
  );
}
