import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "@/lib/convexApi";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palmtree, CalendarClock, ChevronRight } from "lucide-react";

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: "Yıllık",
  sick: "Hastalık",
  excuse: "Mazeret",
  unpaid: "Ücretsiz",
  parental: "Doğum/Ebeveyn",
};

export function PDKSDashboardWidgets() {
  const { loading } = useProjectAccess();
  const widgets = useQuery(api.dashboard.getPdksDashboardWidgets, !loading ? {} : "skip");

  if (loading || !widgets) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-6 pb-4">
      {/* Bekleyen İzin Talepleri */}
      <Card className="border-primary/20 hover:border-primary/40 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-primary" />
            Bekleyen İzin Talepleri
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/leaves" className="text-primary text-xs">
              Tümü <ChevronRight className="h-3 w-3 inline" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {widgets.pendingLeavesCount > 0 ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">
                {widgets.pendingLeavesCount} talep
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {widgets.pendingLeaves.map((l) => (
                  <li key={l._id}>
                    {LEAVE_TYPE_LABELS[l.leaveType] ?? l.leaveType} — {l.startDate} / {l.endDate}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Bekleyen izin talebi yok</p>
          )}
        </CardContent>
      </Card>

      {/* Yaklaşan Vardiya Değişimleri */}
      <Card className="border-primary/20 hover:border-primary/40 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" />
            Yaklaşan Vardiyalar
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/shifts" className="text-primary text-xs">
              Tümü <ChevronRight className="h-3 w-3 inline" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {widgets.upcomingShiftsCount > 0 ? (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-foreground">
                {widgets.upcomingShiftsCount} atama
              </p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {widgets.upcomingShifts.slice(0, 3).map((s) => (
                  <li key={s._id}>
                    {s.startDate} — {s.endDate}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Yaklaşan vardiya ataması yok</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
