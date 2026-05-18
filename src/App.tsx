import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ActiveProjectProvider } from '@/contexts/ActiveProjectContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Layout from '@/components/Layout';
import { useDarkMode } from '@/hooks/useDarkMode';
import './App.css';

const Index = lazy(() => import('@/pages/Index'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const Auth = lazy(() => import('@/pages/Auth'));
const Employees = lazy(() => import('@/pages/Employees'));
const Devices = lazy(() => import('@/pages/Devices'));
const VirtualReaders = lazy(() => import('@/pages/VirtualReaders'));
const AccessControl = lazy(() => import('@/pages/AccessControl'));
const PDKSRecords = lazy(() => import('@/pages/PDKSRecords'));
const Shifts = lazy(() => import('@/pages/Shifts'));
const Leaves = lazy(() => import('@/pages/Leaves'));
const CheckIn = lazy(() => import('@/pages/CheckIn'));
const Settings = lazy(() => import('@/pages/Settings'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));
const Profile = lazy(() => import('@/pages/Profile'));
const SystemAdmin = lazy(() => import('@/pages/SystemAdmin'));
const EngineeringDepartment = lazy(() => import('@/pages/EngineeringDepartment'));
const UserSetup = lazy(() => import('@/pages/UserSetup'));
const EmployeeSetup = lazy(() => import('@/pages/EmployeeSetup'));
const AdminSetup = lazy(() => import('@/pages/AdminSetup'));
const LandingPage = lazy(() => import('@/pages/LandingPage'));
const DemoRequest = lazy(() => import('@/pages/DemoRequest'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function PageFallback() {
  return (
    <div className="flex h-screen items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

function AppContent() {
  useDarkMode();

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/check-in" element={<CheckIn />} />
        <Route path="/demo-request" element={<DemoRequest />} />
        <Route path="/user-setup" element={<UserSetup />} />
        <Route path="/admin-setup" element={<AdminSetup />} />
        <Route path="/employee-setup" element={<EmployeeSetup />} />
        <Route path="/system-admin" element={<SystemAdmin />} />
        <Route element={<Layout />}>
          <Route path="/home" element={<Index />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/virtual-readers" element={<VirtualReaders />} />
          <Route path="/access-control" element={<AccessControl />} />
          <Route path="/pdks-records" element={<PDKSRecords />} />
          <Route path="/shifts" element={<Shifts />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/audit-log" element={<AuditLog />} />
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
