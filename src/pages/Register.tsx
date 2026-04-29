
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import RegisterForm from "@/components/auth/RegisterForm";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export default function Register() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && user) {
      navigate('/home');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner text="Kayıt işlemi kontrol ediliyor..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            P
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PDKS Sistemi</h1>
          <p className="text-gray-600 mt-2">Kayıt Olun</p>
        </div>

        <RegisterForm />
      </div>
    </div>
  );
}
