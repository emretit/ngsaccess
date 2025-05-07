
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, User } from 'lucide-react';

interface UserAccessLog {
  id: number;
  access_time: string;
  device_name: string; 
  device_location: string;
  status: 'success' | 'denied';
  access_granted: boolean;
}

const UserDashboard = () => {
  const { profile, user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('personal');

  // Fetch user's access logs
  const { data: accessLogs, isLoading } = useQuery({
    queryKey: ['userAccessLogs', user?.id],
    queryFn: async () => {
      if (!user?.id) return { logs: [], count: 0 };
      
      const { data, error, count } = await supabase
        .from('card_readings')
        .select('*', { count: 'exact' })
        .eq('employee_id', profile?.id) // Assuming employee_id in card_readings matches the profile id
        .order('access_time', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching access logs:', error);
        throw error;
      }

      return { logs: data as UserAccessLog[], count: count || 0 };
    },
    enabled: !!user?.id && !!profile?.id
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Kullanıcı Paneli
          </h1>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md mb-6">
              <TabsTrigger value="personal" className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>Kişisel Bilgiler</span>
              </TabsTrigger>
              <TabsTrigger value="access-logs" className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M14 22h5a2 2 0 0 0 2-2V7l-5-5H7a2 2 0 0 0-2 2v4" />
                  <path d="M14 2v5h5" />
                  <circle cx="8" cy="16" r="6" />
                  <path d="m2 16 4 4" />
                  <path d="m6 12 4 4" />
                </svg>
                <span>Giriş Kayıtları</span>
              </TabsTrigger>
            </TabsList>

            {/* Personal Info Tab */}
            <TabsContent value="personal" className="mt-0 border-0 p-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Kullanıcı Bilgileri</CardTitle>
                    <CardDescription>Hesap bilgileriniz</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Ad Soyad</p>
                      <p className="text-lg font-semibold">{profile?.email?.split('@')[0] || 'Belirtilmemiş'}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">E-posta</p>
                      <p className="text-lg font-semibold">{profile?.email}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Kullanıcı Rolü</p>
                      <p className="text-lg">
                        <Badge variant="outline" className="font-medium">
                          {profile?.role === 'project_user' ? 'Kullanıcı' : 
                           profile?.role === 'project_admin' ? 'Proje Yöneticisi' : 
                           profile?.role === 'super_admin' ? 'Süper Yönetici' : 'Bilinmiyor'}
                        </Badge>
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Sistem Bilgileri</CardTitle>
                    <CardDescription>Kullanım istatistikleriniz</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Son Giriş</p>
                      <p className="text-lg font-semibold">
                        {user?.last_sign_in_at ? 
                          format(new Date(user.last_sign_in_at), 'dd.MM.yyyy HH:mm', { locale: tr }) : 
                          'Belirtilmemiş'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Kayıt Tarihi</p>
                      <p className="text-lg font-semibold">
                        {user?.created_at ? 
                          format(new Date(user.created_at), 'dd.MM.yyyy', { locale: tr }) : 
                          'Belirtilmemiş'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Toplam Kart Okutma</p>
                      <p className="text-lg font-semibold">{accessLogs?.count || 0}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Access Logs Tab */}
            <TabsContent value="access-logs" className="mt-0 border-0 p-0">
              <Card>
                <CardHeader>
                  <CardTitle>Giriş Çıkış Kayıtları</CardTitle>
                  <CardDescription>Son kart okutma işlemleriniz</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex justify-center items-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                      <span>Yükleniyor...</span>
                    </div>
                  ) : !accessLogs?.logs || accessLogs.logs.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>Henüz kayıt bulunmuyor.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tarih</TableHead>
                            <TableHead>Cihaz</TableHead>
                            <TableHead>Konum</TableHead>
                            <TableHead>Durum</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {accessLogs.logs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                {format(new Date(log.access_time), 'dd.MM.yyyy HH:mm:ss', { locale: tr })}
                              </TableCell>
                              <TableCell>{log.device_name || "Bilinmeyen Cihaz"}</TableCell>
                              <TableCell>{log.device_location || "-"}</TableCell>
                              <TableCell>
                                {log.access_granted || log.status === 'success' ? (
                                  <Badge variant="success">İzin Verildi</Badge>
                                ) : (
                                  <Badge variant="destructive">Reddedildi</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      <div className="text-sm text-gray-500 mt-4">
                        Toplam {accessLogs.count} kayıttan {Math.min(accessLogs.logs.length, 100)} tanesi gösteriliyor
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
