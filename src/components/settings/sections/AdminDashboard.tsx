
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Activity, Settings } from 'lucide-react';
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
          <h2 className="text-2xl font-bold">Sistem Yönetimi</h2>
          <p className="text-muted-foreground">
            Tüm projeleri ve kullanıcıları yönetin
          </p>
        </div>
        <Badge variant="destructive" className="px-3 py-1">
          Süper Admin
        </Badge>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Proje</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalProjects || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeProjects || 0} aktif proje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Kullanıcı</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.activeUsers || 0} aktif kullanıcı
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Süper Admin</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.users?.filter(u => u.role === 'super_admin').length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sistem yöneticisi</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistem Durumu</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Aktif</div>
            <p className="text-xs text-muted-foreground">Tüm sistemler çalışıyor</p>
          </CardContent>
        </Card>
      </div>

      {/* Admin Tabs */}
      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects">Proje Yönetimi</TabsTrigger>
          <TabsTrigger value="users">Kullanıcı Yönetimi</TabsTrigger>
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
