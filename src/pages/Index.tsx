
import { Users, UserCheck, Clock, UserX } from 'lucide-react';
import { Card } from "@/components/ui/card";
import DashboardHeader from '@/components/DashboardHeader';
import StatusCard from '@/components/StatusCard';
import AttendanceChart from '@/components/AttendanceChart';

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col w-full">
      <DashboardHeader />
      <main className="flex-1 p-6 bg-gray-50">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            title="Total Employees"
            value="50"
            icon={<Users className="h-4 w-4 text-blue-500" />}
          />
          <StatusCard
            title="Present Today"
            value="45"
            icon={<UserCheck className="h-4 w-4 text-green-500" />}
          />
          <StatusCard
            title="Late Today"
            value="4"
            icon={<Clock className="h-4 w-4 text-yellow-500" />}
          />
          <StatusCard
            title="Absent Today"
            value="1"
            icon={<UserX className="h-4 w-4 text-red-500" />}
          />
        </div>

        <Card className="mt-6">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Weekly Attendance Overview</h2>
            <AttendanceChart />
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Index;
