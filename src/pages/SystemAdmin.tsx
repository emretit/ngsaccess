
import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminDashboard } from "@/components/settings/sections/AdminDashboard";

export default function SystemAdmin() {
  const { checkUserRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !checkUserRole('super_admin')) {
      navigate('/home');
    }
  }, [checkUserRole, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <div className="w-12 h-12 bg-[#711A1A] rounded-md flex items-center justify-center text-white font-bold mx-auto mb-4">
            P
          </div>
          <p className="text-lg font-medium">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!checkUserRole('super_admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sistem Yönetimi</h1>
            <p className="text-sm text-gray-600">Süper Admin Paneli</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">
              SUPER ADMIN
            </span>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        <AdminDashboard />
      </div>
    </div>
  );
}
