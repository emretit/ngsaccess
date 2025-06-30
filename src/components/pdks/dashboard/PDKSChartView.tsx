
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from "recharts";

const checkInData = [
  { time: '08:00', count: 15 },
  { time: '08:30', count: 45 },
  { time: '09:00', count: 25 },
  { time: '09:30', count: 8 },
  { time: '10:00', count: 3 },
];

const absenceData = [
  { name: 'İzinli', value: 12, color: '#0088FE' },
  { name: 'Hastalık', value: 8, color: '#00C49F' },
  { name: 'Mazeret', value: 5, color: '#FFBB28' },
  { name: 'İzinsiz', value: 2, color: '#FF8042' },
];

const weeklyTrendData = [
  { day: 'Pzt', present: 85, late: 5, absent: 10 },
  { day: 'Sal', present: 88, late: 3, absent: 9 },
  { day: 'Çar', present: 82, late: 8, absent: 10 },
  { day: 'Per', present: 90, late: 2, absent: 8 },
  { day: 'Cum', present: 78, late: 12, absent: 10 },
];

export function PDKSChartView() {
  return (
    <div className="space-y-6">
      {/* Check-in Times Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Günlük Giriş Saatleri Dağılımı</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={checkInData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#711A1A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend Line Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Haftalık Devam Trendi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="present" 
                  stroke="#10B981" 
                  strokeWidth={3}
                  name="Mevcut"
                />
                <Line 
                  type="monotone" 
                  dataKey="late" 
                  stroke="#F59E0B" 
                  strokeWidth={3}
                  name="Geç"
                />
                <Line 
                  type="monotone" 
                  dataKey="absent" 
                  stroke="#EF4444" 
                  strokeWidth={3}
                  name="Yok"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Absence Types Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Devamsızlık Türleri</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={absenceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {absenceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
