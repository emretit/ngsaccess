import { useQuery } from "convex/react";
import { api } from "@/lib/convexApi";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin } from "lucide-react";

export function PDKSCurrentlyInsideWidget() {
  const { projectIds, isSuperAdmin, loading } = useProjectAccess();
  const inside = useQuery(api.dashboard.getCurrentlyInside, !loading ? {} : "skip");

  if (loading || inside === undefined) return null;

  const byZone = new Map<string, typeof inside>();
  const noZone: typeof inside = [];
  for (const p of inside) {
    const zone = p.zone ?? "Belirtilmemiş";
    if (zone === "Belirtilmemiş") {
      noZone.push(p);
    } else {
      if (!byZone.has(zone)) byZone.set(zone, []);
      byZone.get(zone)!.push(p);
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          Şu An İçeride ({inside.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {inside.length === 0 ? (
          <p className="text-sm text-muted-foreground">Şu an binada kimse yok</p>
        ) : (
          <div className="space-y-3">
            {Array.from(byZone.entries()).map(([zone, people]) => (
              <div key={zone}>
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                  <MapPin className="h-3 w-3" />
                  {zone}
                </p>
                <ul className="text-sm space-y-0.5">
                  {people.map((p) => (
                    <li key={p.employeeId}>
                      {p.name} <span className="text-muted-foreground">— {p.department}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {noZone.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Diğer</p>
                <ul className="text-sm space-y-0.5">
                  {noZone.map((p) => (
                    <li key={p.employeeId}>
                      {p.name} <span className="text-muted-foreground">— {p.department}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
