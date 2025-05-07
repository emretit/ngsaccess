
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/components/auth/AuthProvider';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!loading && !session) {
      navigate('/login');
    }
  }, [user, session, loading, navigate]);

  // Show loading screen if checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
            P
          </div>
          <p className="text-lg font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }
  
  // If not authenticated, the useEffect above will redirect to login
  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
};

export default Layout;
