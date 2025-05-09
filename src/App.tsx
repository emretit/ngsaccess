
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
import AdminDashboard from "./pages/dashboard/AdminDashboard";
import UserDashboard from "./pages/dashboard/UserDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public Routes - Not requiring authentication */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/register" element={<Auth />} />
            
            {/* Dashboard Routes - Requiring authentication */}
            <Route path="/admin/dashboard" element={<Layout><AdminDashboard /></Layout>} />
            <Route path="/dashboard" element={<Layout><UserDashboard /></Layout>} />
            
            {/* Protected Routes - Requiring authentication */}
            <Route path="/home" element={<Layout><Index /></Layout>} />
            <Route path="/employees" element={<Layout><Employees /></Layout>} />
            <Route path="/devices" element={<Layout><Devices /></Layout>} />
            <Route path="/access-control" element={<Layout><AccessControl /></Layout>} />
            <Route path="/pdks-records" element={<Layout><PDKSRecords /></Layout>} />
            <Route path="/server-devices" element={<Layout><ServerDevices /></Layout>} />
            <Route path="/settings" element={<Layout><Settings /></Layout>} />
            <Route path="/virtual-readers" element={<Layout><VirtualReaders /></Layout>} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
