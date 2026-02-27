import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/components/auth/AuthProvider';
import Layout from '@/components/Layout';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Auth from '@/pages/Auth';
import Employees from '@/pages/Employees';
import Devices from '@/pages/Devices';
import VirtualReaders from '@/pages/VirtualReaders';
import AccessControl from '@/pages/AccessControl';
import PDKSRecords from '@/pages/PDKSRecords';
import Shifts from '@/pages/Shifts';
import Leaves from '@/pages/Leaves';
import EmployeePortal from '@/pages/EmployeePortal';
import CheckIn from '@/pages/CheckIn';
import Settings from '@/pages/Settings';
import Profile from '@/pages/Profile';
import SystemAdmin from '@/pages/SystemAdmin';
import EngineeringDepartment from '@/pages/EngineeringDepartment';
import UserSetup from '@/pages/UserSetup';
import EmployeeSetup from '@/pages/EmployeeSetup';
import AdminSetup from '@/pages/AdminSetup';
import LandingPage from '@/pages/LandingPage';
import DemoRequest from '@/pages/DemoRequest';
import NotFound from '@/pages/NotFound';
import { useDarkMode } from '@/hooks/useDarkMode';
import './App.css';

function AppContent() {
  useDarkMode();

  return (
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
        <Route path="/employee-portal" element={<EmployeePortal />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/engineering-department" element={<EngineeringDepartment />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Router future={{ v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AppContent />
          <Toaster />
        </AuthProvider>
      </Router>
    </TooltipProvider>
  );
}

export default App;
