
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Sadece kullanıcı oturum açmamışsa ve login/register sayfalarında değilse yönlendir
    if (!loading && !session && location.pathname !== '/login' && location.pathname !== '/register') {
      console.log("Layout: No session detected, redirecting to login from:", location.pathname);
      navigate('/login');
    }
  }, [user, session, loading, navigate, location.pathname]);

  // Show loading screen if checking auth
  if (loading) {
    return <LoadingSpinner text="Sistem hazırlanıyor..." />;
  }
  
  // If not logged in and not on login/register page, useEffect will redirect
  if (!session && location.pathname !== '/login' && location.pathname !== '/register') {
    console.log("Layout: No session, waiting for redirect...");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
