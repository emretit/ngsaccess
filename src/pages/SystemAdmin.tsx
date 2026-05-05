import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminDashboard } from "@/components/settings/sections/AdminDashboard";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Database, Zap, Lock, BarChart3 } from "lucide-react";

export default function SystemAdmin() {
  const { checkUserRole, loading, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("SystemAdmin: Sayfa yüklendi, detaylı kontrol ediliyor...", {
      loading,
      hasUser: !!user,
      userEmail: user?.email,
      hasProfile: !!profile,
      profileRole: profile?.role,
      profileData: profile,
      checkResult: profile ? checkUserRole('super_admin') : 'profile henüz yüklenmedi'
    });

    // Loading tamamlandıktan SONRA yetki kontrolü yap
    if (!loading) {
      console.log("SystemAdmin: Loading tamamlandı, yetki kontrol ediliyor...");
      
      // Kullanıcı giriş yapmış mı kontrol et
      if (!user) {
        console.log("SystemAdmin: Kullanıcı giriş yapmamış, /login'e yönlendiriliyor...");
        navigate('/login');
        return;
      }

      // Profile yüklenmiş mi kontrol et
      if (!profile) {
        console.log("SystemAdmin: Profile henüz yüklenmedi, bekleniyor...");
        return;
      }

      const hasAccess = checkUserRole('super_admin');
      console.log("SystemAdmin: Nihai yetki kontrolü:", {
        userEmail: user.email,
        profileRole: profile.role,
        hasAccess,
        profileId: profile.id
      });

      if (!hasAccess) {
        console.log("SystemAdmin: Yetki yok, /home'a yönlendiriliyor...");
        navigate('/home');
      } else {
        console.log("SystemAdmin: ✅ Yetki onaylandı, sayfa yükleniyor!");
      }
    }
  }, [checkUserRole, loading, navigate, profile, user]);

  // Loading durumunda loading ekranı göster
  if (loading) {
    console.log("SystemAdmin: Loading durumunda...");
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl flex items-center justify-center text-white font-bold mx-auto shadow-2xl animate-pulse">
              <Shield className="w-12 h-12" />
            </div>
            <div className="absolute inset-0 bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl animate-ping opacity-20"></div>
            <div className="absolute -inset-4 bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur-xl opacity-30 animate-pulse"></div>
          </div>
          <h2 className="text-3xl font-bold bg-linear-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-4">
            Sistem Hazırlanıyor...
          </h2>
          <div className="w-80 h-3 bg-slate-700/50 rounded-full mx-auto overflow-hidden backdrop-blur-sm">
            <div className="h-full bg-linear-to-r from-purple-500 via-pink-500 to-blue-500 animate-pulse rounded-full"></div>
          </div>
          <p className="text-purple-300 mt-4 text-sm">Yükleniyor, lütfen bekleyiniz...</p>
        </div>
      </div>
    );
  }

  // Kullanıcı giriş yapmamışsa
  if (!user) {
    console.log("SystemAdmin: Kullanıcı yok, yönlendirme için null döndürülüyor");
    return null;
  }

  // Profile henüz yüklenmemişse
  if (!profile) {
    console.log("SystemAdmin: Profile henüz yüklenmedi, bekleniyor...");
    return (
      <div className="flex items-center justify-center min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-purple-300">Profile yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Yetki kontrolü
  if (!checkUserRole('super_admin')) {
    console.log("SystemAdmin: Yetki kontrol sonucu negatif, null döndürülüyor");
    return null;
  }

  console.log("SystemAdmin: ✅ Tüm kontroller geçildi, sayfa render ediliyor!");

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Enhanced Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>
        <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl animate-pulse delay-700"></div>
        
        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-purple-400 rounded-full animate-ping delay-300"></div>
        <div className="absolute top-3/4 right-1/3 w-1 h-1 bg-pink-400 rounded-full animate-ping delay-1000"></div>
        <div className="absolute bottom-1/3 left-2/3 w-3 h-3 bg-blue-400 rounded-full animate-ping delay-500"></div>
      </div>

      {/* Enhanced Header */}
      <div className="relative z-10 bg-black/30 backdrop-blur-2xl border-b border-white/20 shadow-2xl">
        <div className="px-8 py-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="relative group">
                <div className="w-20 h-20 bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl flex items-center justify-center shadow-2xl group-hover:scale-105 transition-transform duration-300">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-black animate-pulse shadow-lg flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
                <div className="absolute -inset-2 bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur-lg opacity-20 animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-linear-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent leading-tight">
                  Sistem Yönetimi
                </h1>
                <p className="text-purple-300 mt-3 text-xl font-medium">Süper Admin Kontrol Merkezi</p>
                <div className="flex items-center mt-2 space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400 text-sm font-medium">Tüm sistemler çevrimiçi</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-8">
              <div className="text-right">
                <p className="text-purple-300 text-sm font-medium">Hoş geldiniz,</p>
                <p className="text-white font-bold text-xl">{user?.email}</p>
                <p className="text-purple-400 text-xs mt-1">Rol: {profile?.role}</p>
              </div>
              <div className="flex flex-col items-center space-y-3">
                <span className="bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 text-white text-sm font-bold px-6 py-3 rounded-full shadow-xl flex items-center space-x-2 hover:scale-105 transition-transform duration-300">
                  <Shield className="w-5 h-5" />
                  <span>SUPER ADMIN</span>
                </span>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                  <span className="text-green-400 text-xs font-medium">Aktif</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid */}
      <div className="relative z-10 px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <Card className="bg-black/30 backdrop-blur-2xl border-white/20 hover:bg-black/40 transition-all duration-500 group overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-blue-600/30 to-purple-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 to-purple-500"></div>
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm font-semibold uppercase tracking-wider">Sistem Durumu</p>
                  <p className="text-4xl font-bold text-white mt-3 group-hover:scale-105 transition-transform duration-300">Aktif</p>
                  <p className="text-green-400 text-sm mt-2 font-medium">Tüm sistemler çalışıyor</p>
                </div>
                <div className="w-16 h-16 bg-blue-600/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
                  <Database className="w-8 h-8 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/30 backdrop-blur-2xl border-white/20 hover:bg-black/40 transition-all duration-500 group overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-green-600/30 to-emerald-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-green-500 to-emerald-500"></div>
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm font-semibold uppercase tracking-wider">Performans</p>
                  <p className="text-4xl font-bold text-white mt-3 group-hover:scale-105 transition-transform duration-300">Optimal</p>
                  <p className="text-green-400 text-sm mt-2 font-medium">99.9% uptime</p>
                </div>
                <div className="w-16 h-16 bg-green-600/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
                  <Zap className="w-8 h-8 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/30 backdrop-blur-2xl border-white/20 hover:bg-black/40 transition-all duration-500 group overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-purple-600/30 to-pink-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-purple-500 to-pink-500"></div>
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm font-semibold uppercase tracking-wider">Analitik</p>
                  <p className="text-4xl font-bold text-white mt-3 group-hover:scale-105 transition-transform duration-300">Real-time</p>
                  <p className="text-purple-400 text-sm mt-2 font-medium">Canlı veri akışı</p>
                </div>
                <div className="w-16 h-16 bg-purple-600/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
                  <BarChart3 className="w-8 h-8 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/30 backdrop-blur-2xl border-white/20 hover:bg-black/40 transition-all duration-500 group overflow-hidden relative shadow-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-orange-600/30 to-red-600/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-orange-500 to-red-500"></div>
            <CardContent className="p-8 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-sm font-semibold uppercase tracking-wider">Güvenlik</p>
                  <p className="text-4xl font-bold text-white mt-3 group-hover:scale-105 transition-transform duration-300">Maksimum</p>
                  <p className="text-orange-400 text-sm mt-2 font-medium">256-bit şifreleme</p>
                </div>
                <div className="w-16 h-16 bg-orange-600/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
                  <Lock className="w-8 h-8 text-orange-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Main Dashboard Container */}
        <div className="bg-black/30 backdrop-blur-2xl border border-white/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-purple-600 via-pink-600 to-blue-600"></div>
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
          <div className="relative z-10">
            <AdminDashboard />
          </div>
        </div>
      </div>
    </div>
  );
}
