
import React from 'react';
import { Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import Header from '@/components/Header';

const DashboardHeader = () => {
  return (
    <div className="flex items-center">
      <SidebarTrigger>
        <Menu className="h-6 w-6" />
      </SidebarTrigger>
      <div className="flex-1">
        <Header />
      </div>
    </div>
  );
};

export default DashboardHeader;
