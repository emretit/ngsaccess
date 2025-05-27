
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/components/auth/AuthProvider";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AccessControl from "./pages/AccessControl";
import Employees from "./pages/Employees";
import Devices from "./pages/Devices";
import PDKSRecords from "./pages/PDKSRecords";
import ServerDevices from "./pages/ServerDevices";
import Settings from "./pages/Settings";
import VirtualReaders from "./pages/VirtualReaders";
import Profile from "./pages/Profile";
import EmployeeLogin from "./pages/EmployeeLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeSetup from "./pages/EmployeeSetup";
import SystemAdmin from "./pages/SystemAdmin";
import { EmployeeAuthProvider } from "./components/employee-auth/EmployeeAuthProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        {/* Public route for landing page outside of AuthProvider */}
        <Routes>
          <Route path="/" element={
            <>
              <Toaster />
              <Sonner />
              <LandingPage />
            </>
          } />
          
          {/* Employee authentication routes */}
          <Route path="/employee-login" element={
            <EmployeeAuthProvider>
              <Toaster />
              <Sonner />
              <EmployeeLogin />
            </EmployeeAuthProvider>
          } />
          
          <Route path="/employee-setup" element={
            <>
              <Toaster />
              <Sonner />
              <EmployeeSetup />
            </>
          } />
          
          <Route path="/employee-dashboard" element={
            <EmployeeAuthProvider>
              <Toaster />
              <Sonner />
              <EmployeeDashboard />
            </EmployeeAuthProvider>
          } />
          
          {/* Routes requiring authentication */}
          <Route path="*" element={
            <AuthProvider>
              <Toaster />
              <Sonner />
              <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<Auth />} />
                <Route path="/register" element={<Auth />} />
                
                {/* System Admin route - hidden and protected */}
                <Route path="/system-admin" element={<SystemAdmin />} />
                
                {/* Ana sayfa */}
                <Route path="/home" element={<Layout><Index /></Layout>} />
                
                {/* Protected Routes */}
                <Route path="/employees" element={<Layout><Employees /></Layout>} />
                <Route path="/devices" element={<Layout><Devices /></Layout>} />
                <Route path="/access-control" element={<Layout><AccessControl /></Layout>} />
                <Route path="/pdks-records" element={<Layout><PDKSRecords /></Layout>} />
                <Route path="/server-devices" element={<Layout><ServerDevices /></Layout>} />
                <Route path="/settings" element={<Layout><Settings /></Layout>} />
                <Route path="/virtual-readers" element={<Layout><VirtualReaders /></Layout>} />
                <Route path="/profile" element={<Layout><Profile /></Layout>} />
                <Route path="*" element={<Layout><NotFound /></Layout>} />
              </Routes>
            </AuthProvider>
          } />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
