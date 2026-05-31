import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, Shield } from 'lucide-react';
import AdminProjectsPanel from '@/components/admin/AdminProjectsPanel';
import { AdminDevicesPanel } from '@/components/admin/AdminDevicesPanel';
import { IdeDefaultsSettings } from '@/components/admin/IdeDefaultsSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function AdminDashboard() {
  const allProjects = useQuery(api.projects.list);
  const allUsers = useQuery(api.users.list);

  const projects = allProjects ?? [];
  const users = allUsers ?? [];
  const activeProjects = projects.filter((p: { isActive?: boolean }) => p.isActive).length;
  const activeUsers = users.filter((u: { role?: string }) => u.role === "project_user").length;
  const superAdmins = users.filter((u: { role?: string }) => u.role === "super_admin").length;

  const stats = [
    { label: "Toplam Proje", value: projects.length, sub: `${activeProjects} aktif`, icon: Building2 },
    { label: "Toplam Kullanıcı", value: users.length, sub: `${activeUsers} kullanıcı`, icon: Users },
    { label: "Süper Admin", value: superAdmins, sub: "sistem yöneticisi", icon: Shield },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map(({ label, value, sub, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              <Icon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList>
          <TabsTrigger value="projects">Proje & Kullanıcı</TabsTrigger>
          <TabsTrigger value="devices">Cihaz Yönetimi</TabsTrigger>
          <TabsTrigger value="mqtt">MQTT Varsayılanları</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="mt-4">
          <AdminProjectsPanel />
        </TabsContent>
        <TabsContent value="devices" className="mt-4">
          <AdminDevicesPanel />
        </TabsContent>
        <TabsContent value="mqtt" className="mt-4">
          <IdeDefaultsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
