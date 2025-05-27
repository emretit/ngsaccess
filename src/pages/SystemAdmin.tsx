
import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminDashboard } from "@/components/settings/sections/AdminDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Users, Activity, Settings, Zap, Lock, BarChart3 } from "lucide-react";

export default function SystemAdmin() {
  const { checkUserRole, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !checkUserRole('super_admin')) {
      navigate('/home');
    }
  }, [checkUserRole, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center text-white font-bold mx-auto shadow-2xl animate-pulse">
              <Shield className="w-10 h-10" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl animate-ping opacity-25"></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Sistem Hazırlanıyor...</h2>
          <div className="w-64 h-2 bg-slate-700 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!checkUserRole('super_admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl flex items-center justify-center shadow-2xl">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-black animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Sistem Yönetimi
                </h1>
                <p className="text-purple-200 mt-2 text-lg">Süper Admin Kontrol Merkezi</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-purple-200 text-sm">Hoş geldiniz,</p>
                <p className="text-white font-semibold text-lg">{user?.email}</p>
              </div>
              <div className="flex items-center space-x-3">
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold px-4 py-2 rounded-full shadow-lg flex items-center space-x-2">
                  <Shield className="w-4 h-4" />
                  <span>SUPER ADMIN</span>
                </span>
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="relative z-10 px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-black/20 backdrop-blur-xl border-white/10 hover:bg-black/30 transition-all duration-500 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm font-medium">Sistem Durumu</p>
                  <p className="text-3xl font-bold text-white mt-2">Aktif</p>
                  <p className="text-green-400 text-sm mt-1">Tüm sistemler çalışıyor</p>
                </div>
                <div className="w-14 h-14 bg-blue-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Database className="w-7 h-7 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-xl border-white/10 hover:bg-black/30 transition-all duration-500 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-green-600/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm font-medium">Performans</p>
                  <p className="text-3xl font-bold text-white mt-2">Optimal</p>
                  <p className="text-green-400 text-sm mt-1">Yüksek performans</p>
                </div>
                <div className="w-14 h-14 bg-green-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Zap className="w-7 h-7 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-xl border-white/10 hover:bg-black/30 transition-all duration-500 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm font-medium">Analitik</p>
                  <p className="text-3xl font-bold text-white mt-2">Real-time</p>
                  <p className="text-purple-400 text-sm mt-1">Canlı veri izleme</p>
                </div>
                <div className="w-14 h-14 bg-purple-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="w-7 h-7 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-xl border-white/10 hover:bg-black/30 transition-all duration-500 group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-600/20 to-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-200 text-sm font-medium">Güvenlik</p>
                  <p className="text-3xl font-bold text-white mt-2">Maksimum</p>
                  <p className="text-orange-400 text-sm mt-1">256-bit şifreleme</p>
                </div>
                <div className="w-14 h-14 bg-orange-600/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <Lock className="w-7 h-7 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Container */}
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <AdminDashboard />
        </div>
      </div>
    </div>
  );
}
