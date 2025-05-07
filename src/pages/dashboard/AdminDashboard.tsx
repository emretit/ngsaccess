
import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminProjectsPanel from '@/components/admin/AdminProjectsPanel';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel';
import { LayoutDashboard, Users, Shield } from 'lucide-react';

const AdminDashboard = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('projects');

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Süper Admin Paneli
              </h1>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                Hoş geldiniz, {profile?.email}
              </p>
            </div>
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 w-full md:w-auto">
              <CardContent className="p-4">
                <p className="text-red-700 dark:text-red-400 font-medium flex items-center">
                  <Shield className="w-4 h-4 mr-2" />
                  Süper Admin yetkisine sahipsiniz
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
              <TabsTrigger value="projects" className="flex items-center space-x-2">
                <LayoutDashboard className="w-4 h-4" />
                <span>Projeler</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Kullanıcılar</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="projects" className="mt-0 border-0 p-0">
              <AdminProjectsPanel />
            </TabsContent>
            
            <TabsContent value="users" className="mt-0 border-0 p-0">
              <AdminUsersPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
