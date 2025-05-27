
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Activity, Settings, Shield } from 'lucide-react';
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Yönetim Paneli</h2>
          <p className="text-slate-400">
            Tüm projeleri ve kullanıcıları yönetin
          </p>
        </div>
        <Badge variant="destructive" className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 border-0">
          <Shield className="w-4 h-4 mr-2" />
          Süper Admin
        </Badge>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Toplam Proje</CardTitle>
            <Building2 className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats?.totalProjects || 0}</div>
            <p className="text-xs text-slate-400">
              {stats?.activeProjects || 0} aktif proje
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Toplam Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats?.users?.length || 0}</div>
            <p className="text-xs text-slate-400">
              {stats?.activeUsers || 0} aktif kullanıcı
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Süper Admin</CardTitle>
            <Settings className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats?.users?.filter(u => u.role === 'super_admin').length || 0}
            </div>
            <p className="text-xs text-slate-400">Sistem yöneticisi</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Sistem Durumu</CardTitle>
            <Activity className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">Aktif</div>
            <p className="text-xs text-slate-400">Tüm sistemler çalışıyor</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="bg-slate-800/50 border-slate-700">
          <TabsTrigger value="projects" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            Proje Yönetimi
          </TabsTrigger>
          <TabsTrigger value="users" className="data-[state=active]:bg-slate-700 data-[state=active]:text-white">
            Kullanıcı Yönetimi
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="projects" className="mt-6">
          <AdminProjectsPanel />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <AdminUsersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
