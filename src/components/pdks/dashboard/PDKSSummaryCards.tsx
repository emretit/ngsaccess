
import { Users, UserCheck, Clock, Timer, Building } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SummaryData {
  totalEmployees: number;
  presentToday: number;
  lateArrivals: number;
  overtimeHours: number;
  insideBuilding: number;
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
      bgColor: "bg-blue-100"
    },
    {
      title: "Bugün Mevcut",
      value: data.presentToday,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Geç Kalanlar",
      value: data.lateArrivals,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    },
    {
      title: "Mesai Saatleri",
      value: `${data.overtimeHours}h`,
      icon: Timer,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Şu An İçeride",
      value: data.insideBuilding,
      icon: Building,
      color: "text-[#711A1A]",
      bgColor: "bg-[#711A1A]/10"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 p-6">
      {cards.map((card, index) => (
        <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {card.title}
            </CardTitle>
            <div className={`${card.bgColor} p-2 rounded-full`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
