
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/components/auth/AuthProvider';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Redirect unauthenticated users to login page
    // Landing page is handled outside this component in App.tsx
    if (!loading && !session && location.pathname !== '/login' && location.pathname !== '/register') {
      console.log("Layout: No session detected, redirecting to login from:", location.pathname);
      navigate('/login');
    }
  }, [user, session, loading, navigate, location.pathname]);

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
  
  // If not logged in and not on login/register page, useEffect will redirect
  if (!session && location.pathname !== '/login' && location.pathname !== '/register') {
    console.log("Layout: No session, waiting for redirect...");
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
