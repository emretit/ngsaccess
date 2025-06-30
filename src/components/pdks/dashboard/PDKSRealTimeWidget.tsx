
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Users, Clock, AlertTriangle, Wifi, WifiOff } from "lucide-react";

export function PDKSRealTimeWidget() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Mock real-time data
  const realTimeData = {
    currentlyInside: 42,
    totalCapacity: 150,
    todayEntries: 138,
    todayExits: 96,
    afterHoursAlerts: 2,
    lastActivity: "2 dk önce",
    recentActivities: [
      { name: "Ahmet Yılmaz", action: "Gidiş", time: "18:23" },
      { name: "Fatma Demir", action: "Giriş", time: "18:20" },
      { name: "Mehmet Özkan", action: "Gidiş", time: "18:18" },
    ]
  };

  const occupancyPercentage = (realTimeData.currentlyInside / realTimeData.totalCapacity) * 100;

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building className="h-5 w-5 text-[#711A1A]" />
              Canlı Takip
            </span>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <Badge variant={isConnected ? "default" : "destructive"} className="text-xs">
                {isConnected ? "Bağlı" : "Bağlantı Yok"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Time */}
          <div className="text-center p-4 bg-gradient-to-r from-[#711A1A] to-[#8B1C26] rounded-xl text-white">
            <div className="text-2xl font-bold">
              {currentTime.toLocaleTimeString('tr-TR', { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
            <div className="text-sm opacity-80">
              {currentTime.toLocaleDateString('tr-TR', { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>

          {/* Current Occupancy */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Şu An İçeride</span>
              <span className="text-2xl font-bold text-[#711A1A]">
                {realTimeData.currentlyInside}
              </span>
            </div>
            
            {/* Occupancy Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-[#711A1A] to-[#8B1C26] h-3 rounded-full transition-all duration-500"
                style={{ width: `${occupancyPercentage}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-gray-500">
              <span>0</span>
              <span>{occupancyPercentage.toFixed(1)}% doluluk</span>
              <span>{realTimeData.totalCapacity}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Summary */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">📊 Günlük Özet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-green-700">{realTimeData.todayEntries}</div>
              <div className="text-xs text-green-600">Giriş</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-center">
              <div className="text-lg font-bold text-blue-700">{realTimeData.todayExits}</div>
              <div className="text-xs text-blue-600">Çıkış</div>
            </div>
          </div>
          
          {realTimeData.afterHoursAlerts > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {realTimeData.afterHoursAlerts} mesai dışı uyarı
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-[#711A1A]" />
            Son Hareketler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {realTimeData.recentActivities.map((activity, index) => (
              <div 
                key={index}
                className="flex justify-between items-center p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-gray-800">
                    {activity.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {activity.time}
                  </div>
                </div>
                <Badge 
                  variant={activity.action === 'Giriş' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {activity.action}
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-center text-xs text-gray-500">
              Son güncelleme: {realTimeData.lastActivity}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
