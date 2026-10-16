
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import DemoRequestHero from "@/components/demo/DemoRequestHero";
import DemoFeatures from "@/components/demo/DemoFeatures";
import EnhancedDemoRequestForm from "@/components/demo/EnhancedDemoRequestForm";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingFooter from "@/components/landing/LandingFooter";

export default function DemoRequest() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    if (!loading && user && user.verified !== false) {
      navigate('/home');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <LoadingSpinner text="Yükleniyor..." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main id="main" tabIndex={-1}>
        <EnhancedDemoRequestForm />
        <DemoRequestHero />
        <DemoFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
