import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

// This is just a redirect page now
export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading) {
      if (user) {
        // If already authenticated, go to home
        navigate('/');
      } else {
        // Otherwise go to auth page, using replace to avoid back button issues
        navigate('/login', { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse text-center">
        <div className="w-12 h-12 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
          P
        </div>
        <p className="text-lg font-medium">Yönlendiriliyor...</p>
      </div>
    </div>
  );
}
