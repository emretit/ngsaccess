
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
      bgColor: "bg-gradient-to-br from-blue-50 to-blue-100",
      borderColor: "border-blue-200",
      change: "+2 bu ay",
      changeType: "positive" as const
    },
    {
      title: "Bugün Mevcut",
      value: data.presentToday,
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-gradient-to-br from-green-50 to-green-100",
      borderColor: "border-green-200",
      change: "88% devam oranı",
      changeType: "positive" as const
    },
    {
      title: "Geç Kalanlar",
      value: data.lateArrivals,
      icon: Clock,
      color: "text-orange-600",
      bgColor: "bg-gradient-to-br from-orange-50 to-orange-100",
      borderColor: "border-orange-200",
      change: "-2 dünden",
      changeType: "positive" as const
    },
    {
      title: "Mesai Saatleri",
      value: `${data.overtimeHours}h`,
      icon: Timer,
      color: "text-purple-600",
      bgColor: "bg-gradient-to-br from-purple-50 to-purple-100",
      borderColor: "border-purple-200",
      change: "+5h bu hafta",
      changeType: "neutral" as const
    },
    {
      title: "Şu An İçeride",
      value: data.insideBuilding,
      icon: Building,
      color: "text-[#711A1A]",
      bgColor: "bg-gradient-to-br from-red-50 to-red-100",
      borderColor: "border-red-200",
      change: "Canlı veri",
      changeType: "neutral" as const
    }
  ];

  return (
    <div className="px-6 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <Card 
            key={index} 
            className={`
              ${card.bgColor} ${card.borderColor} 
              hover:shadow-xl transition-all duration-300 hover:scale-105 
              border-2 cursor-pointer group
            `}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 group-hover:text-gray-800 transition-colors">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-full bg-white/80 group-hover:bg-white transition-colors shadow-sm`}>
                <card.icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-2">
                <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {card.value}
                </div>
                <div className={`
                  text-xs font-medium
                  ${card.changeType === 'positive' ? 'text-green-600' : 
                    card.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'}
                `}>
                  {card.change}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
