import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingUp, Clock, Users, AlertTriangle } from "lucide-react";
import { usePdksChartData } from "@/hooks/usePdksChartData";

const CHART_COLORS = {
  present: "#10B981",
  late: "#F59E0B",
  absent: "#EF4444",
  primary: "hsl(var(--primary))",
};

export function PDKSChartView() {
  const {
    dailyAttendance,
    departmentAbsence,
    lateDistribution,
    hourlyTrend,
    isLoading,
  } = usePdksChartData(7);

  const dailyAttendanceData = dailyAttendance.length
    ? dailyAttendance.map((d) => ({
        name: d.name,
        present: d.present,
        late: d.late,
        absent: d.absent,
        oran: d.rate,
      }))
    : [
        { name: "Pazartesi", present: 0, late: 0, absent: 0, oran: 0 },
        { name: "Salı", present: 0, late: 0, absent: 0, oran: 0 },
        { name: "Çarşamba", present: 0, late: 0, absent: 0, oran: 0 },
        { name: "Perşembe", present: 0, late: 0, absent: 0, oran: 0 },
        { name: "Cuma", present: 0, late: 0, absent: 0, oran: 0 },
      ];

  const hourlyTrendData =
    hourlyTrend.length > 0
      ? hourlyTrend
      : [
          { hour: "08:00", checkins: 0 },
          { hour: "09:00", checkins: 0 },
          { hour: "17:00", checkins: 0 },
          { hour: "18:00", checkins: 0 },
        ];

  const absenceTypeData =
    departmentAbsence.length > 0
      ? departmentAbsence.map((d, i) => ({
          name: d.name,
          value: d.absences,
          color: ["#EF4444", "#F59E0B", "#3B82F6", "#10B981"][i % 4],
        }))
      : [{ name: "Veri yok", value: 1, color: "#E5E7EB" }];

  const lateDistributionData =
    lateDistribution.length > 0
      ? lateDistribution
      : [
          { hour: "08:00", count: 0 },
          { hour: "09:00", count: 0 },
          { hour: "10:00", count: 0 },
        ];

  const avgRate =
    dailyAttendanceData.length > 0
      ? Math.round(
          dailyAttendanceData.reduce((s, d) => s + (d.oran ?? 0), 0) /
            dailyAttendanceData.length
        )
      : 0;
  const totalLate = dailyAttendanceData.reduce((s, d) => s + (d.late ?? 0), 0);
  const totalAbsent = dailyAttendanceData.reduce((s, d) => s + (d.absent ?? 0), 0);
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-linear-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Haftalık Ortalama Devam</p>
                <p className="text-2xl font-bold text-foreground">%{avgRate}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-green-50 to-green-100 border-green-200 hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">En İyi Gün</p>
                <p className="text-2xl font-bold text-foreground">
                  {dailyAttendanceData.length > 0
                    ? dailyAttendanceData.reduce((best, d) =>
                        (d.oran ?? 0) > (best.oran ?? 0) ? d : best
                      ).name
                    : "-"}
                </p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Toplam Geç Kalma</p>
                <p className="text-2xl font-bold text-foreground">{totalLate} kişi</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-linear-to-br from-red-50 to-red-100 border-red-200 hover:shadow transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Toplam Devamsızlık</p>
                <p className="text-2xl font-bold text-foreground">{totalAbsent} gün</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Attendance Bar Chart */}
        <Card className="border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              📊 Haftalık Devam Durumu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Bar dataKey="present" fill={CHART_COLORS.present} name="Mevcut" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" fill={CHART_COLORS.late} name="Geç" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill={CHART_COLORS.absent} name="Yok" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Check-in Trend */}
        <Card className="border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              ⏰ Saatlik Giriş Trendi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="checkins"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={3}
                  dot={{ fill: CHART_COLORS.primary, strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: CHART_COLORS.primary, strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Devam Oranı Çizgi + Geç Kalma Dağılımı */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              📈 Günlük Devam Oranı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                  formatter={(value) => [`%${value}`, "Devam Oranı"]}
                />
                <Line
                  type="monotone"
                  dataKey="oran"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={2}
                  dot={{ fill: CHART_COLORS.primary, r: 4 }}
                  name="Devam Oranı"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-sm hover:shadow transition-shadow">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              ⏱️ Geç Kalma Saat Dağılımı
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={lateDistributionData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis dataKey="hour" type="category" width={50} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                  }}
                />
                <Bar dataKey="count" fill={CHART_COLORS.late} name="Geç Kalan" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-sm hover:shadow transition-shadow">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            🥧 Departman Devamsızlık Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={absenceTypeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {absenceTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
