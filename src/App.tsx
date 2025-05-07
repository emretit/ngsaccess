
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AccessControl from "./pages/AccessControl";
import Employees from "./pages/Employees";
import Devices from "./pages/Devices";
import PDKSRecords from "./pages/PDKSRecords";
import ServerDevices from "./pages/ServerDevices";
import Settings from "./pages/Settings";
import VirtualReaders from "./pages/VirtualReaders";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout><Index /></Layout>} />
          <Route path="/employees" element={<Layout><Employees /></Layout>} />
          <Route path="/devices" element={<Layout><Devices /></Layout>} />
          <Route path="/access-control" element={<Layout><AccessControl /></Layout>} />
          <Route path="/pdks-records" element={<Layout><PDKSRecords /></Layout>} />
          <Route path="/server-devices" element={<Layout><ServerDevices /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          <Route path="/virtual-readers" element={<Layout><VirtualReaders /></Layout>} />
          <Route path="*" element={<Layout><NotFound /></Layout>} />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
