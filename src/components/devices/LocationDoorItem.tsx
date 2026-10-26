import { formatTrDateTime } from "@/lib/date";
import { useId } from "react";
import type { FunctionReturnType } from "convex/server";
import { ArrowRightLeft, ChevronRight, DoorOpen, Plus, Settings2, Trash2 } from "lucide-react";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { INSET_FOCUS, TREE_NAME_BUTTON, TREE_ROW_ACTIONS, TREE_ROW_HEIGHT, TREE_TOGGLE_BUTTON } from "@/components/shared/TreePanel";
import { deviceDisplayName } from "@/lib/deviceDisplay";
import { cn } from "@/lib/utils";
import type { api } from "../../../convex/_generated/api";

export type DoorNode = FunctionReturnType<typeof api.doors.list>[number];
export type DeviceNode = FunctionReturnType<typeof api.devices.list>[number];
/** readerStatus satırı (okuyucu başına); kapı başına 1..2 satır. */
export type ReaderRow = FunctionReturnType<typeof api.doors.readerStatus>[number];

export type DoorAction =
  | { type: "editDoor"; door: DoorNode }
  | { type: "openDoor"; door: DoorNode }
  | { type: "deleteDoor"; door: DoorNode }
  | { type: "addReader"; door: DoorNode }
  | { type: "editReader"; door: DoorNode; reader: ReaderRow }
  | { type: "moveReader"; door: DoorNode; reader: ReaderRow }
  | { type: "fetchReaderCfg"; door: DoorNode; reader: ReaderRow }
  | { type: "deleteReader"; door: DoorNode; reader: ReaderRow };

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });

/** Okuyucunun durum ve Hik teknik ayrıntıları; menü başlığında ve ipucunda gösterilir. */
function readerDetails(reader: ReaderRow): string[] {
  return [
    `${reader.online ? "Çevrimiçi" : "Çevrimdışı"}${reader.lastReadAt ? ` · son okuma ${formatTime(reader.lastReadAt)}` : ""}`,
    reader.hikReaderNo !== null ? `Hik okuyucu #${reader.hikReaderNo}` : null,
    reader.hikCardReaderPlanTemplateNo !== null ? `Plan ${reader.hikCardReaderPlanTemplateNo}` : null,
    reader.hikCardReaderAntiSneakEnabled !== null ? `APB ${reader.hikCardReaderAntiSneakEnabled ? "açık" : "kapalı"}` : null,
    reader.hikLastCfgAt ? `Ayar okundu ${formatTrDateTime(new Date(reader.hikLastCfgAt))}` : null,
  ].filter((item): item is string => item !== null);
}

interface LocationDoorItemProps {
  door: DoorNode;
  /** Kapının bağlı olduğu panel (doors.deviceId). */
  device: DeviceNode | null;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
  /** undefined → okuyucular yükleniyor. */
  readers: ReaderRow[] | undefined;
  canAddReader: boolean;
  canManage?: boolean;
  canOpenDoor?: boolean;
  fetchingReaderId: string | null;
  /** Verilmezse satır salt okunur (yönetici değil). */
  onAction?: (action: DoorAction) => void;
}

/** Konum ağacında kapı satırı ve altındaki okuyucular. */
export function LocationDoorItem({
  door,
  device,
  selected,
  expanded,
  onToggle,
  onSelect,
  readers,
  canAddReader,
  canManage = false,
  canOpenDoor = false,
  fetchingReaderId,
  onAction,
}: LocationDoorItemProps) {
  const listId = useId();
  const isIde = device?.brand === "ide_smart";
  const canFetchCfg = device?.brand === "hikvision" && device.hikTransport === "gateway";
  const deviceName = device ? deviceDisplayName(device) : null;
  return (
    <li>
      <div className={cn("group flex min-w-0 items-center rounded-sm", selected ? "bg-selected text-primary" : "hover:bg-muted")}>
        <button
          type="button"
          className={TREE_TOGGLE_BUTTON}
          aria-label={`${door.name} okuyucuları`}
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={onToggle}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
        </button>
        <button
          type="button"
          className={cn(TREE_NAME_BUTTON, selected && "font-medium")}
          aria-pressed={selected}
          title={deviceName ?? undefined}
          onClick={onSelect}
        >
          {door.name}
        </button>
        {onAction && (canManage || (isIde && canOpenDoor)) && (
          <div className={TREE_ROW_ACTIONS}>
            <RowActions label={`${door.name} kapı işlemleri`}>
              {deviceName && (
                <DropdownMenuLabel className="max-w-64 truncate text-xs font-normal text-muted-foreground">{deviceName}</DropdownMenuLabel>
              )}
              {canManage && <DropdownMenuItem onSelect={() => onAction({ type: "editDoor", door })}>
                <Settings2 className="mr-2 h-4 w-4" />Kapıyı düzenle
              </DropdownMenuItem>}
              {isIde && canOpenDoor && (
                <DropdownMenuItem onSelect={() => onAction({ type: "openDoor", door })}>
                  <DoorOpen className="mr-2 h-4 w-4" />Kapıyı aç
                </DropdownMenuItem>
              )}
              {canManage && !isIde && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onSelect={() => onAction({ type: "deleteDoor", door })}>
                    <Trash2 className="mr-2 h-4 w-4" />Kapıyı sil
                  </DropdownMenuItem>
                </>
              )}
            </RowActions>
          </div>
        )}
      </div>
      <ul id={listId} hidden={!expanded} className="ml-2.5 space-y-0.5 border-l pl-0.5">
        {readers === undefined ? (
          <li className="py-1 pl-2 text-xs text-muted-foreground">Okuyucular yükleniyor…</li>
        ) : (
          <>
            {readers.length === 0 && <li className="py-1 pl-2 text-xs text-muted-foreground">Okuyucu atanmamış.</li>}
            {readers.map((reader) => {
              const details = readerDetails(reader);
              const label = reader.readerName || "Okuyucu";
              const fetching = reader.readerId !== null && fetchingReaderId === reader.readerId;
              return (
                <li key={reader.readerId ?? `legacy-${door._id}`}>
                  <div className={cn("group flex min-w-0 items-center gap-1.5 rounded-sm pl-2 hover:bg-muted", TREE_ROW_HEIGHT)} title={details.join(" · ")}>
                    <span aria-hidden="true" className={cn("h-1.5 w-1.5 shrink-0 rounded-full", reader.online ? "status-success-bg" : "bg-muted-foreground/40")} />
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      <span className="text-foreground">{label}</span>
                      <span className="block text-[10px]">{reader.online ? "Çevrimiçi" : "Çevrimdışı"}</span>
                    </span>
                    {reader.hikCardReaderAntiSneakEnabled === true && (
                      <span className="status-warning-badge shrink-0 rounded-sm px-1 text-[10px] font-medium">APB</span>
                    )}
                    {onAction && canManage && reader.readerId !== null && (
                      <div className={TREE_ROW_ACTIONS}>
                        <RowActions label={`${reader.readerName} okuyucu işlemleri`}>
                          <DropdownMenuLabel className="max-w-64 space-y-0.5 text-xs font-normal text-muted-foreground">
                            {details.map((line) => <span key={line} className="block">{line}</span>)}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => onAction({ type: "editReader", door, reader })}>
                            <Settings2 className="mr-2 h-4 w-4" />Düzenle
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => onAction({ type: "moveReader", door, reader })}>
                            <ArrowRightLeft className="mr-2 h-4 w-4" />Taşı
                          </DropdownMenuItem>
                          {canFetchCfg && (
                            <DropdownMenuItem disabled={fetching} onSelect={() => onAction({ type: "fetchReaderCfg", door, reader })}>
                              <Settings2 className="mr-2 h-4 w-4" />{fetching ? "Ayarlar okunuyor…" : "Cihaz ayarlarını oku"}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onSelect={() => onAction({ type: "deleteReader", door, reader })}>
                            <Trash2 className="mr-2 h-4 w-4" />Sil
                          </DropdownMenuItem>
                        </RowActions>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
            {onAction && canManage && canAddReader && (
              <li>
                <button
                  type="button"
                  className={cn("flex w-full items-center gap-1.5 rounded-sm pl-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground", TREE_ROW_HEIGHT, INSET_FOCUS)}
                  onClick={() => onAction({ type: "addReader", door })}
                >
                  <Plus aria-hidden="true" className="h-3 w-3" />
                  Okuyucu ekle
                </button>
              </li>
            )}
          </>
        )}
      </ul>
    </li>
  );
}
