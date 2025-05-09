
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';

const Auth = () => {
  const { user, session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isRegisterPage = location.pathname === '/register';
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      console.log("Auth: User already logged in, redirecting to home");
      // Kullanıcı zaten giriş yapmışsa, yönlendirme işlemini başlat
      setRedirecting(true);
      
      // User is logged in, redirect to home
      navigate('/home');
    }
  }, [user, session, loading, navigate]);

  if (loading || redirecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
            P
          </div>
          <p className="text-lg font-medium">{redirecting ? 'Yönlendiriliyor...' : 'Yükleniyor...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#711A1A] rounded-md flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            P
          </div>
          <h1 className="text-2xl font-bold">PDKS Sistemi</h1>
          <p className="text-muted-foreground mt-2">
            Personel Devam Kontrol Sistemi
          </p>
        </div>

        {isRegisterPage ? <RegisterForm /> : <LoginForm />}
      </div>
    </div>
  );
};

export default Auth;
