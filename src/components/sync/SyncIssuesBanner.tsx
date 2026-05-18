import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { api } from "../../../convex/_generated/api";
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

type SyncIssue = FunctionReturnType<typeof api.hikvisionSync.listSyncIssues>[number];
type Operation = SyncIssue["operation"];

const OPERATION_LABELS: Record<Operation, string> = {
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

export function SyncIssuesBanner() {
  const issues = useQuery(api.hikvisionSync.listSyncIssues, { limit: 50 });
  const dismiss = useMutation(api.hikvisionSync.dismissSyncIssue);
  const dismissAll = useMutation(api.hikvisionSync.dismissAllSyncIssues);
  const [expanded, setExpanded] = useState(false);

  if (!issues || issues.length === 0) return null;

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
            {issues.length}
          </Badge>
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const count = await dismissAll();
              toast({ description: `${count} hata temizlendi` });
            }}
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
          {issues.map((issue) => (
            <li
              key={issue._id}
              className="flex items-start justify-between gap-3 px-4 py-2 text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">
                    {issue.deviceName}
                  </span>
                  {issue.deviceBrand && (
                    <Badge variant="outline" className="text-[10px]">
                      {issue.deviceBrand}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {OPERATION_LABELS[issue.operation] ?? issue.operation}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDistanceToNow(issue.createdAt, { addSuffix: true, locale: tr })}
                  </span>
                </div>
                <div className="text-xs text-destructive mt-1 break-all">
                  {issue.lastError}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => dismiss({ issueId: issue._id })}
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
