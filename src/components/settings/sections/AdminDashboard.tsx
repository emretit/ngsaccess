
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Activity, Settings, Shield, TrendingUp, Clock } from 'lucide-react';
import AdminProjectsPanel from '@/components/admin/AdminProjectsPanel';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
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
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Yönetim Merkezi
          </h2>
          <p className="text-purple-200 mt-2">
            Tüm projeleri ve kullanıcıları merkezi olarak yönetin
          </p>
        </div>
        <Badge variant="destructive" className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 border-0 text-white font-semibold">
          <Shield className="w-5 h-5 mr-2" />
          Süper Admin Paneli
        </Badge>
      </div>

      {/* Enhanced Dashboard Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-purple-200">Toplam Proje</CardTitle>
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-2">{stats?.totalProjects || 0}</div>
            <div className="flex items-center text-xs text-green-400">
              <TrendingUp className="w-3 h-3 mr-1" />
              {stats?.activeProjects || 0} aktif proje
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-purple-200">Toplam Kullanıcı</CardTitle>
            <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Users className="h-5 w-5 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-2">{stats?.users?.length || 0}</div>
            <div className="flex items-center text-xs text-green-400">
              <Clock className="w-3 h-3 mr-1" />
              {stats?.activeUsers || 0} aktif kullanıcı
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-purple-200">Süper Admin</CardTitle>
            <div className="w-10 h-10 bg-purple-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Settings className="h-5 w-5 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white mb-2">
              {stats?.users?.filter(u => u.role === 'super_admin').length || 0}
            </div>
            <div className="flex items-center text-xs text-purple-400">
              <Shield className="w-3 h-3 mr-1" />
              Sistem yöneticisi
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all duration-300 group">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-purple-200">Sistem Durumu</CardTitle>
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <Activity className="h-5 w-5 text-orange-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400 mb-2">Aktif</div>
            <div className="flex items-center text-xs text-green-400">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Tüm sistemler çalışıyor
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Admin Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="bg-white/5 border-white/10 backdrop-blur-sm p-1 h-12">
          <TabsTrigger 
            value="projects" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-purple-200 font-medium px-6 py-2 rounded-lg transition-all duration-300"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Proje Yönetimi
          </TabsTrigger>
          <TabsTrigger 
            value="users" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white text-purple-200 font-medium px-6 py-2 rounded-lg transition-all duration-300"
          >
            <Users className="w-4 h-4 mr-2" />
            Kullanıcı Yönetimi
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="mt-8">
          <div className="bg-white/5 border-white/10 backdrop-blur-sm rounded-2xl p-6">
            <AdminProjectsPanel />
          </div>
        </TabsContent>

        <TabsContent value="users" className="mt-8">
          <div className="bg-white/5 border-white/10 backdrop-blur-sm rounded-2xl p-6">
            <AdminUsersPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
