
import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/Layout';

const AdminDashboard = () => {
  const { profile } = useAuth();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Süper Admin Paneli
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            Hoş geldiniz, {profile?.email}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="bg-primary/10 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Kullanıcı Yönetimi</h3>
              <p>Tüm kullanıcı hesaplarını ve rollerini yönetin.</p>
            </div>
            <div className="bg-primary/10 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Proje Yönetimi</h3>
              <p>Projeleri oluşturun, düzenleyin ve yönetin.</p>
            </div>
            <div className="bg-primary/10 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Sistem Ayarları</h3>
              <p>Tüm sistem ayarlarına ve izinlere erişim.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
