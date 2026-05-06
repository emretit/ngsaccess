import { Users, UserCheck, Clock, Timer, Building, Palmtree } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SummaryData {
  totalEmployees: number;
  presentToday: number;
  lateArrivals: number;
  overtimeHours: number;
  insideBuilding: number;
  leaveToday?: number;
  devamOrani?: number;
  topLateDepartment?: string;
  topLateDepartmentCount?: number;
}

interface PDKSSummaryCardsProps {
  data: SummaryData;
}

export function PDKSSummaryCards({ data }: PDKSSummaryCardsProps) {
  const cards = [
    {
      title: "Toplam Çalışan",
      value: data.totalEmployees,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-linear-to-br from-blue-50 to-blue-100",
      borderColor: "border-blue-200",
      change: "Aktif çalışan",
      changeType: "neutral" as const,
    },
    {
      title: "Bugün Mevcut",
      value: data.presentToday,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-linear-to-br from-green-50 to-green-100",
      borderColor: "border-green-200",
      change: `%${data.devamOrani ?? 0} devam oranı`,
      changeType: "positive" as const,
    },
    {
      title: "Geç Kalanlar",
      value: data.lateArrivals,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-linear-to-br from-orange-50 to-orange-100",
      borderColor: "border-orange-200",
      change:
        data.topLateDepartment && data.topLateDepartment !== "-"
          ? `En çok: ${data.topLateDepartment} (${data.topLateDepartmentCount})`
          : "Bugün",
      changeType: "neutral" as const,
    },
    {
      title: "Mesai Saatleri",
      value: `${data.overtimeHours}h`,
      icon: Timer,
      color: "text-purple-600",
      bgColor: "bg-linear-to-br from-purple-50 to-purple-100",
      borderColor: "border-purple-200",
      change: "Bugün toplam",
      changeType: "neutral" as const,
    },
    {
      title: "İzindeki",
      value: data.leaveToday ?? 0,
      icon: Palmtree,
      color: "text-primary",
      bgColor: "bg-linear-to-br from-primary/10 to-primary/5",
      borderColor: "border-primary/30",
      change: "Bugün izinli",
      changeType: "neutral" as const,
    },
    {
      title: "Şu An İçeride",
      value: data.insideBuilding,
      icon: Building,
      color: "text-primary",
      bgColor: "bg-linear-to-br from-red-50 to-red-100",
      borderColor: "border-red-200",
      change: "Canlı veri",
      changeType: "neutral" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card, index) => (
        <Card
          key={index}
          className={cn(
            card.bgColor,
            card.borderColor,
            "border hover:shadow-md transition-shadow"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className="p-1.5 rounded-full bg-card/80 shadow-xs">
              <card.icon className={cn("h-4 w-4 sm:h-5 sm:w-5", card.color)} />
            </div>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-4 sm:pt-0">
            <div className="text-2xl sm:text-3xl font-bold text-foreground">
              {card.value}
            </div>
            <div
              className={cn(
                "text-[11px] sm:text-xs font-medium mt-1",
                card.changeType === "positive"
                  ? "text-green-600"
                  : card.changeType === "neutral"
                    ? "text-muted-foreground"
                    : "text-red-600"
              )}
            >
              {card.change}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
