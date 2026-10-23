import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ActiveProjectProvider } from '@/contexts/ActiveProjectContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';

const Index = lazy(() => import('@/pages/Index'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const Employees = lazy(() => import('@/pages/Employees'));
const Devices = lazy(() => import('@/pages/Devices'));
const VirtualReaderKiosk = lazy(() => import('@/pages/VirtualReaderKiosk'));
const AccessControl = lazy(() => import('@/pages/AccessControl'));
const Visitors = lazy(() => import('@/pages/Visitors'));
const LiveMonitoring = lazy(() => import('@/pages/LiveMonitoring'));
const PDKSRecords = lazy(() => import('@/pages/PDKSRecords'));
const PdksSettings = lazy(() => import('@/pages/PdksSettings'));
const Leaves = lazy(() => import('@/pages/Leaves'));
const CheckIn = lazy(() => import('@/pages/CheckIn'));
const Settings = lazy(() => import('@/pages/Settings'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));
const Alarms = lazy(() => import('@/pages/Alarms'));
const Reports = lazy(() => import('@/pages/Reports'));
const Profile = lazy(() => import('@/pages/Profile'));
const SystemAdmin = lazy(() => import('@/pages/SystemAdmin'));
const EngineeringDepartment = lazy(() => import('@/pages/EngineeringDepartment'));
const UserSetup = lazy(() => import('@/pages/UserSetup'));
const EmployeeSetup = lazy(() => import('@/pages/EmployeeSetup'));
const AdminSetup = lazy(() => import('@/pages/AdminSetup'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function AppContent() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  // Rota değişince sayfa başından açılır (bölüm bağlantıları ve geri/ileri hariç); uygulama kabuğu kendi kaydırmasını yönetir.
  useEffect(() => {
    if (!hash && navigationType !== 'POP') window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/reader" element={<VirtualReaderKiosk />} />
        {/* Sanal okuyucular artık Cihazlar → Cihaz ekle menüsünde. */}
        <Route path="/virtual-readers" element={<Navigate to="/devices" replace />} />
        <Route path="/demo-request" element={<Navigate to="/register" replace />} />
        <Route path="/user-setup" element={<UserSetup />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/employee-setup" element={<EmployeeSetup />} />
        <Route element={<Layout />}>
          <Route path="/home" element={<Index />} />
          <Route path="/system-admin" element={<SystemAdmin />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/access-control" element={<AccessControl />} />
          <Route path="/visitors" element={<Visitors />} />
          <Route path="/live-monitoring" element={<LiveMonitoring />} />
          <Route path="/pdks-records" element={<PDKSRecords />} />
          <Route path="/pdks-records/settings" element={<PdksSettings />} />
          <Route path="/shifts" element={<Navigate to="/pdks-records?plan=1" replace />} />
          <Route path="/shifts/definitions" element={<Navigate to="/pdks-records" replace />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/alarms" element={<Alarms />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reports/:group" element={<Reports />} />
          <Route path="/reports/:group/:slug" element={<Reports />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/engineering-department" element={<EngineeringDepartment />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <TooltipProvider>
        <Router>
          <AuthProvider>
            <ActiveProjectProvider>
              <AppContent />
              <Toaster />
            </ActiveProjectProvider>
          </AuthProvider>
        </Router>
      </TooltipProvider>
    </ErrorBoundary>
  );
}

export default App;
