import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { EmployeeAuthProvider } from '@/components/employee-auth/EmployeeAuthProvider';
import Layout from '@/components/Layout';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Auth from '@/pages/Auth';
import Employees from '@/pages/Employees';
import Devices from '@/pages/Devices';
import ServerDevices from '@/pages/ServerDevices';
import VirtualReaders from '@/pages/VirtualReaders';
import AccessControl from '@/pages/AccessControl';
import PDKSRecords from '@/pages/PDKSRecords';
import Settings from '@/pages/Settings';
import Profile from '@/pages/Profile';
import SystemAdmin from '@/pages/SystemAdmin';
import EngineeringDepartment from '@/pages/EngineeringDepartment';
import EmployeeLogin from '@/pages/EmployeeLogin';
import EmployeeDashboard from '@/pages/EmployeeDashboard';
import EmployeeSetup from '@/pages/EmployeeSetup';
import UserSetup from '@/pages/UserSetup';
import LandingPage from '@/pages/LandingPage';
import NotFound from '@/pages/NotFound';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router future={{ v7_relativeSplatPath: true }}>
        <AuthProvider>
          <EmployeeAuthProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/employee-login" element={<EmployeeLogin />} />
              <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
              <Route path="/employee-setup" element={<EmployeeSetup />} />
              <Route path="/user-setup" element={<UserSetup />} />
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
                path="/server-devices" 
                element={
                  <Layout>
                    <ServerDevices />
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
            <Toaster />
          </EmployeeAuthProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
