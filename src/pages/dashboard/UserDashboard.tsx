
import React from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import Layout from '@/components/Layout';

const UserDashboard = () => {
  const { profile } = useAuth();

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
            Kullanıcı Paneli
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            Hoş geldiniz, {profile?.email}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-primary/10 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Kayıtlarım</h3>
              <p>Kendi giriş çıkış kayıtlarınızı görüntüleyin.</p>
            </div>
            <div className="bg-primary/10 p-6 rounded-lg">
              <h3 className="text-xl font-semibold mb-2">Profil Ayarları</h3>
              <p>Profil bilgilerinizi görüntüleyin ve düzenleyin.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserDashboard;
