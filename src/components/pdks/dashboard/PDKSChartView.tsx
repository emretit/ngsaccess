
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Clock, Users, AlertTriangle } from "lucide-react";

// Mock data for charts
const dailyAttendanceData = [
  { name: 'Pazartesi', present: 142, late: 8, absent: 5 },
  { name: 'Salı', present: 138, late: 12, absent: 3 },
  { name: 'Çarşamba', present: 145, late: 5, absent: 7 },
  { name: 'Perşembe', present: 140, late: 10, absent: 4 },
  { name: 'Cuma', present: 135, late: 15, absent: 8 },
];

const hourlyTrendData = [
  { hour: '08:00', checkins: 45 },
  { hour: '09:00', checkins: 120 },
  { hour: '10:00', checkins: 15 },
  { hour: '11:00', checkins: 8 },
  { hour: '12:00', checkins: 25 },
  { hour: '13:00', checkins: 110 },
  { hour: '14:00', checkins: 12 },
  { hour: '17:00', checkins: 35 },
  { hour: '18:00', checkins: 95 },
];

const absenceTypeData = [
  { name: 'İzinli', value: 15, color: '#3B82F6' },
  { name: 'Hastalık', value: 8, color: '#EF4444' },
  { name: 'Resmi Tatil', value: 5, color: '#10B981' },
  { name: 'Diğer', value: 3, color: '#F59E0B' },
];

export function PDKSChartView() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Chart Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Haftalık Ortalama</p>
                <p className="text-2xl font-bold text-gray-900">94.2%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">En İyi Gün</p>
                <p className="text-2xl font-bold text-gray-900">Çarşamba</p>
              </div>
              <Users className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Ortalama Geç Kalma</p>
                <p className="text-2xl font-bold text-gray-900">10 kişi</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200 hover:shadow-lg transition-all duration-300">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Toplam İzin</p>
                <p className="text-2xl font-bold text-gray-900">31 gün</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Attendance Bar Chart */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
                <Bar dataKey="present" fill="#10B981" name="Mevcut" radius={[4, 4, 0, 0]} />
                <Bar dataKey="late" fill="#F59E0B" name="Geç" radius={[4, 4, 0, 0]} />
                <Bar dataKey="absent" fill="#EF4444" name="Yok" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hourly Check-in Trend */}
        <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
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
                  stroke="#711A1A" 
                  strokeWidth={3}
                  dot={{ fill: '#711A1A', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#711A1A', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Pie Chart and Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Absence Types Pie Chart */}
        <Card className="lg:col-span-2 shadow-xl border-0 bg-white/90 backdrop-blur-sm hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              🥧 İzin Türleri Dağılımı
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {absenceTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="shadow-xl border-0 bg-gradient-to-br from-gray-50 to-white hover:shadow-2xl transition-all duration-300">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-gray-900">📈 Hızlı İstatistikler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
              <span className="text-sm font-medium text-gray-700">Toplam Çalışma Saati</span>
              <span className="text-lg font-bold text-blue-600">1,248h</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors">
              <span className="text-sm font-medium text-gray-700">Mesai Saatleri</span>
              <span className="text-lg font-bold text-green-600">156h</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
              <span className="text-sm font-medium text-gray-700">Ortalama Giriş</span>
              <span className="text-lg font-bold text-yellow-600">08:45</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
              <span className="text-sm font-medium text-gray-700">Ortalama Çıkış</span>
              <span className="text-lg font-bold text-purple-600">18:15</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
