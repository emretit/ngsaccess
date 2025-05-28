
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Activity, Settings, Shield, TrendingUp, Clock, Monitor } from 'lucide-react';
import AdminProjectsPanel from '@/components/admin/AdminProjectsPanel';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import AdminDevicesPanel from '@/components/admin/AdminDevicesPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AdminDashboard() {
  // Fetch dashboard statistics
  const { data: stats } = useQuery({
    queryKey: ['admin', 'dashboard-stats'],
    queryFn: async () => {
      const [projectsRes, usersRes, activeUsersRes] = await Promise.all([
        supabase.from('projects').select('id, name, is_active'),
        supabase.from('users').select('id, email, role'),
        supabase.from('users').select('id').eq('role', 'project_user')
      ]);

      return {
        projects: projectsRes.data || [],
        users: usersRes.data || [],
        activeUsers: activeUsersRes.data?.length || 0,
        totalProjects: projectsRes.data?.length || 0,
        activeProjects: projectsRes.data?.filter(p => p.is_active).length || 0
      };
    }
  });

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Yönetim Merkezi
          </h2>
          <p className="text-purple-300 mt-3 text-lg">
            Tüm projeleri ve kullanıcıları merkezi olarak yönetin
          </p>
        </div>
        <Badge className="px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 border-0 text-white font-bold text-lg shadow-xl hover:scale-105 transition-transform duration-300">
          <Shield className="w-6 h-6 mr-3" />
          Süper Admin Paneli
        </Badge>
      </div>

      {/* Enhanced Dashboard Stats */}
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Toplam Proje</CardTitle>
            <div className="w-12 h-12 bg-blue-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
              <Building2 className="h-6 w-6 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-white mb-3 group-hover:scale-105 transition-transform duration-300">{stats?.totalProjects || 0}</div>
            <div className="flex items-center text-sm text-green-400 font-medium">
              <TrendingUp className="w-4 h-4 mr-2" />
              {stats?.activeProjects || 0} aktif proje
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-emerald-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Toplam Kullanıcı</CardTitle>
            <div className="w-12 h-12 bg-green-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
              <Users className="h-6 w-6 text-green-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-white mb-3 group-hover:scale-105 transition-transform duration-300">{stats?.users?.length || 0}</div>
            <div className="flex items-center text-sm text-green-400 font-medium">
              <Clock className="w-4 h-4 mr-2" />
              {stats?.activeUsers || 0} aktif kullanıcı
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/20 to-pink-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Süper Admin</CardTitle>
            <div className="w-12 h-12 bg-purple-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
              <Settings className="h-6 w-6 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-white mb-3 group-hover:scale-105 transition-transform duration-300">
              {stats?.users?.filter(u => u.role === 'super_admin').length || 0}
            </div>
            <div className="flex items-center text-sm text-purple-400 font-medium">
              <Shield className="w-4 h-4 mr-2" />
              Sistem yöneticisi
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/10 border-white/20 backdrop-blur-xl hover:bg-white/15 transition-all duration-500 group relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
          <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-red-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 relative z-10">
            <CardTitle className="text-sm font-bold text-purple-200 uppercase tracking-wider">Sistem Durumu</CardTitle>
            <div className="w-12 h-12 bg-orange-500/30 rounded-2xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 backdrop-blur-sm">
              <Activity className="h-6 w-6 text-orange-400" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-4xl font-bold text-green-400 mb-3 group-hover:scale-105 transition-transform duration-300">Aktif</div>
            <div className="flex items-center text-sm text-green-400 font-medium">
              <div className="w-3 h-3 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Tüm sistemler çalışıyor
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Premium Unified Admin Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="bg-white/5 border border-white/10 backdrop-blur-2xl p-2 h-20 shadow-2xl rounded-2xl">
          <TabsTrigger 
            value="projects" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:via-pink-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-purple-500/25 text-purple-200 font-bold px-8 py-4 rounded-xl transition-all duration-500 hover:bg-white/10 data-[state=active]:scale-105 data-[state=active]:border-0 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
            <div className="relative z-10 flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-500/30 rounded-lg flex items-center justify-center group-data-[state=active]:bg-white/20 transition-all duration-300 backdrop-blur-sm">
                <Building2 className="w-5 h-5" />
              </div>
              <span className="text-lg">Proje Yönetimi</span>
            </div>
          </TabsTrigger>
          
          <TabsTrigger 
            value="users" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:via-pink-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-purple-500/25 text-purple-200 font-bold px-8 py-4 rounded-xl transition-all duration-500 hover:bg-white/10 data-[state=active]:scale-105 data-[state=active]:border-0 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
            <div className="relative z-10 flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-500/30 rounded-lg flex items-center justify-center group-data-[state=active]:bg-white/20 transition-all duration-300 backdrop-blur-sm">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-lg">Kullanıcı Yönetimi</span>
            </div>
          </TabsTrigger>
          
          <TabsTrigger 
            value="devices" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:via-pink-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-xl data-[state=active]:shadow-purple-500/25 text-purple-200 font-bold px-8 py-4 rounded-xl transition-all duration-500 hover:bg-white/10 data-[state=active]:scale-105 data-[state=active]:border-0 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl"></div>
            <div className="relative z-10 flex items-center space-x-3">
              <div className="w-8 h-8 bg-orange-500/30 rounded-lg flex items-center justify-center group-data-[state=active]:bg-white/20 transition-all duration-300 backdrop-blur-sm">
                <Monitor className="w-5 h-5" />
              </div>
              <span className="text-lg">Cihaz Yönetimi</span>
            </div>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="mt-10">
          <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600"></div>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <AdminProjectsPanel />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-10">
          <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600"></div>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-green-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <AdminUsersPanel />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="devices" className="mt-10">
          <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-3xl p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600"></div>
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl"></div>
            <div className="relative z-10">
              <AdminDevicesPanel />
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
