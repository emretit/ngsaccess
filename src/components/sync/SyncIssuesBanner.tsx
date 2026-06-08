import { useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { api } from "../../../convex/_generated/api";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { friendlySyncError, isBenignSyncError } from "@/lib/syncErrorMessages";

type HikIssue = FunctionReturnType<typeof api.hikvisionSync.listSyncIssues>[number];
type IdeIssue = FunctionReturnType<typeof api.ideSync.listSyncIssues>[number];
type HikOperation = HikIssue["operation"];
type IdeOpType = IdeIssue["opType"];

const HIK_OPERATION_LABELS: Record<HikOperation, string> = {
  addPerson: "Kişi ekleme",
  updatePerson: "Kişi güncelleme",
  deletePerson: "Kişi silme",
  addCard: "Kart ekleme",
  deleteCard: "Kart silme",
  addFace: "Yüz ekleme",
  deleteFace: "Yüz silme",
  addFingerprint: "Parmak izi ekleme",
  deleteFingerprint: "Parmak izi silme",
  syncWeekPlan: "Haftalık plan",
  syncHoliday: "Tatil planı",
  syncDoorParam: "Kapı parametresi",
  openDoor: "Kapı açma",
};

const IDE_OP_LABELS: Record<IdeOpType, string> = {
  openDoor: "Kapı açma",
  upsertUser: "Kişi yazma",
  deleteUser: "Kişi silme",
  upsertPermission: "Yetki yazma",
  deletePermission: "Yetki silme",
  triggerSync: "Tam senkron",
  parameterWrite: "Cihaz parametresi",
};

// Hikvision + IDE Smart başarısız op'larını tek banner'da birleştirir (discriminated union
// → dismiss doğru mutation'a tip-güvenli yönlenir).
type UnifiedItem =
  | { source: "hikvision"; issue: HikIssue }
  | { source: "ide"; issue: IdeIssue };

export function SyncIssuesBanner() {
  const hikIssues = useQuery(api.hikvisionSync.listSyncIssues, { limit: 50 });
  const ideIssues = useQuery(api.ideSync.listSyncIssues, { limit: 50 });
  const dismissHik = useMutation(api.hikvisionSync.dismissSyncIssue);
  const dismissAllHik = useMutation(api.hikvisionSync.dismissAllSyncIssues);
  const dismissIde = useMutation(api.ideSync.dismissSyncIssue);
  const dismissAllIde = useMutation(api.ideSync.dismissAllSyncIssues);
  const [expanded, setExpanded] = useState(false);

  const { items, extraByDevice } = useMemo(() => {
    const h: UnifiedItem[] = (hikIssues ?? []).map((issue) => ({ source: "hikvision", issue }));
    const i: UnifiedItem[] = (ideIssues ?? []).map((issue) => ({ source: "ide", issue }));
    // "Cihaz güncel" (already exists) gibi benign durumları problem listesine ALMA.
    const sorted = [...h, ...i]
      .filter((it) => !isBenignSyncError(it.issue.lastError))
      .sort((a, b) => b.issue.createdAt - a.issue.createdAt);
    // Cihaz başına toplam uyarı sayısı ("+N eski" rozeti için).
    const extraByDevice = new Map<string, number>();
    for (const it of sorted) {
      extraByDevice.set(it.issue.deviceId, (extraByDevice.get(it.issue.deviceId) ?? 0) + 1);
    }
    // Kalabalığı önle: her cihaz için yalnızca EN SON uyarı (sorted desc → ilk görülen en yeni).
    const seen = new Set<string>();
    const latest: UnifiedItem[] = [];
    for (const it of sorted) {
      if (seen.has(it.issue.deviceId)) continue;
      seen.add(it.issue.deviceId);
      latest.push(it);
    }
    return { items: latest, extraByDevice };
  }, [hikIssues, ideIssues]);

  if (items.length === 0) return null;

  const labelFor = (item: UnifiedItem): string =>
    item.source === "ide"
      ? IDE_OP_LABELS[item.issue.opType] ?? item.issue.opType
      : HIK_OPERATION_LABELS[item.issue.operation] ?? item.issue.operation;

  const brandFor = (item: UnifiedItem): string =>
    item.source === "ide" ? "ide_smart" : item.issue.deviceBrand ?? "hikvision";

  const handleDismiss = (item: UnifiedItem) => {
    if (item.source === "ide") {
      void dismissIde({ opId: item.issue._id });
    } else {
      void dismissHik({ issueId: item.issue._id });
    }
  };

  const handleDismissAll = async () => {
    const [hik, ide] = await Promise.all([dismissAllHik(), dismissAllIde()]);
    toast({ description: `${(hik ?? 0) + (ide ?? 0)} hata temizlendi` });
  };

  return (
    <div className="border-b bg-destructive/10 text-destructive">
      <div className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex flex-1 items-center gap-2 hover:bg-destructive/15 rounded px-1 -mx-1"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Senkronizasyon Sorunları</span>
          <Badge variant="destructive" className="ml-1">
            {items.length}
          </Badge>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismissAll}
            className="h-7 text-xs"
          >
            Hepsini kapat
          </Button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="p-1 hover:bg-destructive/15 rounded"
            aria-label={expanded ? "Daralt" : "Genişlet"}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="max-h-64 overflow-y-auto divide-y divide-destructive/20 bg-background">
          {items.map((item) => (
            <li
              key={item.issue._id}
              className="flex items-start justify-between gap-3 px-4 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {item.issue.deviceName}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {brandFor(item)}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {labelFor(item)}
                  </Badge>
                  {(extraByDevice.get(item.issue.deviceId) ?? 1) > 1 && (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      +{(extraByDevice.get(item.issue.deviceId) ?? 1) - 1} eski
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(item.issue.createdAt, { addSuffix: true, locale: tr })}
                  </span>
                </div>
                <div
                  className="text-xs text-destructive mt-1 break-all"
                  title={item.issue.lastError ?? undefined}
                >
                  {friendlySyncError(item.issue.lastError)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => handleDismiss(item)}
              >
                <X className="w-4 h-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
