
import React from 'react';
import { Button } from "@/components/ui/button";
import { Bell, Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const DashboardHeader = () => {
  return (
    <header className="border-b bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger>
            <Menu className="h-6 w-6" />
          </SidebarTrigger>
          <h1 className="text-xl font-semibold">PDKS Management System</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
