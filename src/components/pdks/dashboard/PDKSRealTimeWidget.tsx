import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Clock, Wifi, WifiOff } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export function PDKSRealTimeWidget() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const inside = useQuery(api.dashboard.getCurrentlyInside, {});
  const recent = useQuery(api.dashboard.getRecentReadings, { limit: 8 });

  const isConnected = inside !== undefined && recent !== undefined;
  const insideCount = inside?.length ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="border border-border shadow-sm md:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building className="h-4 w-4 text-primary" />
              Canlı Durum
            </span>
            <div className="flex items-center gap-1.5">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-muted-foreground" />
              )}
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {isConnected ? "Bağlı" : "Bekleniyor"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center p-4 bg-primary text-primary-foreground rounded-lg">
            <div className="text-2xl font-bold font-mono tracking-wide">
              {currentTime.toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            <div className="text-xs opacity-80 mt-1">
              {currentTime.toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>

          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-1">Şu An İçeride</div>
            <div className="text-4xl font-bold text-primary">{insideCount}</div>
            <div className="text-xs text-muted-foreground mt-1">çalışan</div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border shadow-sm md:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Son Hareketler
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recent === undefined ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Yükleniyor...
            </div>
          ) : recent.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Henüz hareket yok.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((r) => {
                const granted = r.accessStatus === "izin_verildi";
                const time = format(new Date(r.accessTime), "HH:mm", { locale: tr });
                const date = format(new Date(r.accessTime), "dd MMM", { locale: tr });
                return (
                  <div
                    key={r._id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {r.employeeName ?? r.cardNo ?? "Bilinmiyor"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.devices?.name ?? "Cihaz"} · {date}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-xs font-mono text-muted-foreground">
                        {time}
                      </span>
                      <Badge
                        variant={granted ? "default" : "destructive"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {granted ? "İzinli" : "Reddedildi"}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
