
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@/components/auth/AuthProvider";
import LoginForm from "@/components/auth/LoginForm";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { api } from "@/lib/convexApi";
import { Link } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const hasAdmin = useQuery(api.users.hasSuperAdmin);

  useEffect(() => {
    if (!loading && user) {
      navigate("/home");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner text="Giriş kontrol ediliyor..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
            P
          </div>
          <h1 className="text-3xl font-bold text-gray-900">PDKS Sistemi</h1>
          <p className="text-gray-600 mt-2">Giriş Yapın</p>
        </div>

        <LoginForm />

        {hasAdmin === false && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Henüz yönetici yok mu?{" "}
            <Link to="/admin-setup" className="text-primary hover:underline">
              İlk kurulumu yapın
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
