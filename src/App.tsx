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
      <Route
        path="/home"
        element={
          <Layout>
            <Index />
          </Layout>
        }
      />
      <Route
        path="/employees"
        element={
          <Layout>
            <Employees />
          </Layout>
        }
      />
      <Route
        path="/devices"
        element={
          <Layout>
            <Devices />
          </Layout>
        }
      />
      <Route
        path="/virtual-readers"
        element={
          <Layout>
            <VirtualReaders />
          </Layout>
        }
      />
      <Route
        path="/access-control"
        element={
          <Layout>
            <AccessControl />
          </Layout>
        }
      />
      <Route
        path="/pdks-records"
        element={
          <Layout>
            <PDKSRecords />
          </Layout>
        }
      />
      <Route
        path="/shifts"
        element={
          <Layout>
            <Shifts />
          </Layout>
        }
      />
      <Route
        path="/leaves"
        element={
          <Layout>
            <Leaves />
          </Layout>
        }
      />
      <Route
        path="/employee-portal"
        element={
          <Layout>
            <EmployeePortal />
          </Layout>
        }
      />
      <Route
        path="/settings"
        element={
          <Layout>
            <Settings />
          </Layout>
        }
      />
      <Route
        path="/profile"
        element={
          <Layout>
            <Profile />
          </Layout>
        }
      />
      <Route
        path="/engineering-department"
        element={
          <Layout>
            <EngineeringDepartment />
          </Layout>
        }
      />
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
