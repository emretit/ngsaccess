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
  employeeIds: Id<"employees">[];
}

interface PDKSSmartPresetsProps {
  selection: SmartPresetSelection | null;
  onChange: (sel: SmartPresetSelection | null) => void;
}

export function PDKSSmartPresets({ selection, onChange }: PDKSSmartPresetsProps) {
  const convex = useConvex();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const runPreset = async (key: SmartPresetSelection["key"], label: string) => {
    setLoadingKey(key);
    try {
      let employeeIds: Id<"employees">[] = [];
      if (key === "repeat-late") {
        const rows = await convex.query(api.dashboard.getRepeatLateOffenders, {
          daysBack: 30,
          minCount: 3,
        });
        employeeIds = rows.map((r) => r.employeeId);
      } else if (key === "annual-overtime-near") {
        const rows = await convex.query(api.dashboard.getAnnualOvertimeBalance, {
          year: new Date().getFullYear(),
        });
        employeeIds = rows.filter((r) => r.utilizationPct >= 80).map((r) => r.employeeId);
      } else if (key === "break-violation") {
        const rows = await convex.query(api.dashboard.getBreakViolations, {
          date: toLocalDateString(new Date()),
        });
        employeeIds = rows.map((r) => r.employeeId);
      }
      onChange({ key, label, employeeIds });
    } finally {
      setLoadingKey(null);
    }
  };

  const presets: Array<{
    key: SmartPresetSelection["key"];
    label: string;
    icon: typeof AlertTriangle;
  }> = [
    { key: "repeat-late", label: "Sürekli geç kalanlar (30g · 3+)", icon: Clock },
    { key: "annual-overtime-near", label: "270h yaklaşanlar (%80+)", icon: AlertTriangle },
    { key: "break-violation", label: "Mola ihlali (bugün)", icon: Coffee },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => {
        const Icon = p.icon;
        const active = selection?.key === p.key;
        const loading = loadingKey === p.key;
        return (
          <Button
            key={p.key}
            variant={active ? "default" : "outline"}
            size="sm"
            disabled={loading}
            className="h-7 text-xs rounded-full gap-1.5"
            onClick={() => runPreset(p.key, p.label)}
          >
            <Icon className="h-3 w-3" />
            {loading ? "..." : p.label}
          </Button>
        );
      })}
      {selection && (
        <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
          {selection.employeeIds.length} kişi · {selection.label}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="ml-0.5 rounded-full hover:bg-background/60 p-0.5"
            aria-label="Akıllı filtreyi kaldır"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
