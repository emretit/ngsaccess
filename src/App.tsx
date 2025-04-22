import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Index from "./pages/Index";
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
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/devices" element={<Devices />} />
            <Route path="/access-control" element={<AccessControl />} />
            <Route path="/pdks-records" element={<PDKSRecords />} />
            <Route path="/server-devices" element={<ServerDevices />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/virtual-readers" element={<VirtualReaders />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
