import { useMemo } from "react";
import { useQuery } from "convex/react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { api } from "../../../../convex/_generated/api";

const WARNING_PCT = 80;
const CRITICAL_PCT = 100;

export function PDKSOvertimeAlert() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const balance = useQuery(api.dashboard.getAnnualOvertimeBalance, { year });

  if (!balance) return null;

  const critical = balance.filter((b) => b.utilizationPct >= CRITICAL_PCT);
  const warning = balance.filter(
    (b) => b.utilizationPct >= WARNING_PCT && b.utilizationPct < CRITICAL_PCT,
  );

  if (critical.length === 0 && warning.length === 0) return null;

  const top = critical.length > 0 ? critical : warning;
  const Icon = critical.length > 0 ? ShieldAlert : AlertTriangle;

  return (
    <Alert
      variant={critical.length > 0 ? "destructive" : "default"}
      className={critical.length > 0 ? undefined : "border-amber-500 text-amber-700"}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle>
        {critical.length > 0
          ? `${critical.length} çalışan 270 saat yıllık fazla mesai sınırını aştı`
          : `${warning.length} çalışan 270 saat sınırına yaklaşıyor (%${WARNING_PCT}+)`}
      </AlertTitle>
      <AlertDescription>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {top.slice(0, 8).map((b) => (
            <Badge
              key={b.employeeId}
              variant={critical.length > 0 ? "destructive" : "outline"}
              className="text-xs font-normal"
            >
              {b.firstName} {b.lastName} — {b.totalOvertimeHours}h ({b.utilizationPct}%)
            </Badge>
          ))}
          {top.length > 8 && (
            <span className="text-xs text-muted-foreground">
              +{top.length - 8} daha
            </span>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
