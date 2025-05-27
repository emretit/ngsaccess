
import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminDashboard } from "@/components/settings/sections/AdminDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Users, Activity } from "lucide-react";

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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center text-white font-bold mx-auto mb-6 shadow-2xl">
            <Shield className="w-8 h-8" />
          </div>
          <p className="text-xl font-medium text-white">Sistem yükleniyor...</p>
          <div className="mt-4 w-48 h-2 bg-slate-700 rounded-full mx-auto overflow-hidden">
            <div className="h-full bg-gradient-to-r from-red-500 to-red-600 animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!checkUserRole('super_admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-slate-700/50">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-red-700 rounded-xl flex items-center justify-center shadow-lg">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">Sistem Yönetimi</h1>
                <p className="text-slate-300 mt-1">Süper Admin Kontrol Paneli</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-slate-400">Hoş geldiniz,</p>
                <p className="text-white font-medium">{user?.email}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>SUPER ADMIN</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-black/20 backdrop-blur-sm border-slate-700/50 hover:bg-black/30 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center">
                  <Database className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Sistem Durumu</p>
                  <p className="text-2xl font-bold text-white">Aktif</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-sm border-slate-700/50 hover:bg-black/30 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Aktif Kullanıcılar</p>
                  <p className="text-2xl font-bold text-white">--</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-sm border-slate-700/50 hover:bg-black/30 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Toplam Projeler</p>
                  <p className="text-2xl font-bold text-white">--</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-sm border-slate-700/50 hover:bg-black/30 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-orange-600/20 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <p className="text-slate-400 text-sm">Güvenlik</p>
                  <p className="text-2xl font-bold text-white">Güvenli</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard */}
        <div className="bg-black/20 backdrop-blur-sm border border-slate-700/50 rounded-2xl p-6">
          <AdminDashboard />
        </div>
      </div>
    </div>
  );
}
