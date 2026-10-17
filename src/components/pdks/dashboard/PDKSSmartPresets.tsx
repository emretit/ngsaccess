import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { notify } from "@/lib/notify";
import { readableDate } from "../lib/presentation";
import { useState } from "react";
import { useConvex } from "convex/react";
import { AlertTriangle, Clock, Coffee, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toLocalDateString } from "@/lib/date";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface SmartPresetSelection {
  key: "repeat-late" | "annual-overtime-near" | "break-violation";
  label: string;
  date?: string;
  employeeIds: Id<"employees">[];
}

interface PDKSSmartPresetsProps {
  anchorDate: Date;
  selection: SmartPresetSelection | null;
  onChange: (sel: SmartPresetSelection | null) => void;
}

export function PDKSSmartPresets({
  anchorDate,
  selection,
  onChange,
}: PDKSSmartPresetsProps) {
  const convex = useConvex();
  const { projectId, activeProject } = useActiveProject();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const runPreset = async (key: SmartPresetSelection["key"], label: string) => {
    if (loadingKey || !projectId) return;
    setLoadingKey(key);
    try {
      let employeeIds: Id<"employees">[] = [];
      if (key === "repeat-late") {
        const rows = await convex.query(api.dashboard.getRepeatLateOffenders, {
          projectId,
          daysBack: 30,
          minCount: 3,
        });
        employeeIds = rows.map((r) => r.employeeId);
      } else if (key === "annual-overtime-near") {
        const rows = await convex.query(
          api.dashboard.getAnnualOvertimeBalance,
          {
            projectId,
            year: anchorDate.getFullYear(),
          },
        );
        employeeIds = rows
          .filter((r) => r.utilizationPct >= 80)
          .map((r) => r.employeeId);
      } else if (key === "break-violation") {
        const rows = await convex.query(api.dashboard.getBreakViolations, {
          projectId,
          date: toLocalDateString(anchorDate),
        });
        employeeIds = rows.map((r) => r.employeeId);
      }
      onChange({
        key,
        label,
        employeeIds,
        date:
          key === "break-violation" ? toLocalDateString(anchorDate) : undefined,
      });
    } catch (error) {
      notify.error("Uyarı listesi yüklenemedi", error);
    } finally {
      setLoadingKey(null);
    }
  };

  const presets: Array<{
    key: SmartPresetSelection["key"];
    label: string;
    icon: typeof AlertTriangle;
  }> = [
    {
      key: "repeat-late",
      label: "Tekrar geç kalanlar · son 30 gün (3+ gün)",
      icon: Clock,
    },
    {
      key: "annual-overtime-near",
      label: `Yıllık mesai sınırına yaklaşanlar · ${anchorDate.getFullYear()} yılı`,
      icon: AlertTriangle,
    },
    {
      key: "break-violation",
      label: `Mola uyarıları · ${readableDate(toLocalDateString(anchorDate))}`,
      icon: Coffee,
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {activeProject?.name} · Bu uyarılar kendi tarih kapsamını kullanır.
        Listeye uygulandığında mevcut dönem ve filtreler korunur.
      </p>
      {presets.map((p) => {
        const Icon = p.icon;
        const active = selection?.key === p.key;
        const loading = loadingKey === p.key;
        return (
          <Button
            key={p.key}
            variant={active ? "default" : "outline"}
            size="sm"
            disabled={Boolean(loadingKey) || !projectId}
            className="h-auto min-h-9 max-w-full justify-start gap-1.5 whitespace-normal text-left text-xs"
            onClick={() => runPreset(p.key, p.label)}
          >
            <Icon className="h-3 w-3" />
            {loading ? "Yükleniyor…" : p.label}
          </Button>
        );
      })}
      {selection && (
        <Badge
          variant="secondary"
          className="max-w-full gap-1 whitespace-normal pr-1 text-xs font-normal"
        >
          {selection.employeeIds.length} kişi · {selection.label}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-0.5 shrink-0 rounded-sm hover:bg-background/60 p-2"
            aria-label="Akıllı filtreyi kaldır"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
