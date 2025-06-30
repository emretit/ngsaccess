
import { useState, useEffect } from "react";
import { Users, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RealTimeData {
  currentlyInside: number;
  afterHoursCount: number;
  lastUpdate: string;
}

export function PDKSRealTimeWidget() {
  const [realTimeData, setRealTimeData] = useState<RealTimeData>({
    currentlyInside: 42,
    afterHoursCount: 3,
    lastUpdate: new Date().toLocaleTimeString('tr-TR')
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: new Date().toLocaleTimeString('tr-TR')
      }));
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const isAfterHours = () => {
    const now = new Date();
    const hours = now.getHours();
    return hours < 8 || hours > 18; // Outside 8 AM - 6 PM
  };

  return (
    <div className="space-y-4">
      {/* Current Inside Count */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-[#711A1A]" />
            Şu An İçeride
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-[#711A1A] mb-2">
            {realTimeData.currentlyInside}
          </div>
          <div className="text-sm text-gray-500 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Son güncelleme: {realTimeData.lastUpdate}
          </div>
        </CardContent>
      </Card>

      {/* After Hours Alert */}
      {isAfterHours() && realTimeData.afterHoursCount > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
              <AlertTriangle className="h-5 w-5" />
              Mesai Dışı Uyarı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm">
                Mesai saati dışında {realTimeData.afterHoursCount} kişi içeride
              </span>
              <Badge variant="outline" className="border-orange-300 text-orange-700">
                Dikkat
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Günlük Özet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Toplam Giriş</span>
            <span className="font-semibold">89</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Toplam Çıkış</span>
            <span className="font-semibold">47</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Geç Gelenler</span>
            <span className="font-semibold text-orange-600">12</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
