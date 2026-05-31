import { useAuth } from "@/components/auth/AuthProvider";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { AdminDashboard } from "@/components/settings/sections/AdminDashboard";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export default function SystemAdmin() {
  const { checkUserRole, loading, user, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login");
      return;
    }
    if (!profile) return;
    if (!checkUserRole("super_admin")) {
      navigate("/home");
    }
  }, [checkUserRole, loading, navigate, profile, user]);

  if (loading || (user && !profile)) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span>Yükleniyor...</span>
      </div>
    );
  }

  if (!user || !checkUserRole("super_admin")) {
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Projeleri, kullanıcıları ve cihazları merkezi olarak yönetin
        </p>
        <Badge variant="secondary">Super Admin</Badge>
      </div>
      <AdminDashboard />
    </div>
  );
}
