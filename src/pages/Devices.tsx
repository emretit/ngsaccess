
import { useState } from 'react';
import { Plus } from "lucide-react";
import { format } from 'date-fns';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { useDevices } from '@/hooks/useDevices';
import { Device, Project } from '@/types/device';
import { DeviceForm } from '@/components/devices/DeviceForm';

export default function Devices() {
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | undefined>();

  const { data: devices, isLoading } = useDevices(selectedProject);
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*');
      return (data || []) as Project[];
    },
  });

  const getStatusBadge = (device: Device) => {
    const isOnline = device.last_used_at && 
      new Date(device.last_used_at) > new Date(Date.now() - 5 * 60 * 1000);
    
    return (
      <Badge variant={isOnline ? "success" : "destructive"}>
        {isOnline ? 'Online' : 'Offline'}
      </Badge>
    );
  };

  const formatLastSeen = (date: string | null) => {
    if (!date) return 'Never';
    return format(new Date(date), 'MMM d, yyyy HH:mm');
  };

  return (
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Devices</h1>
          
          <div className="flex gap-4">
            <Select
              value={selectedProject?.toString() || 'all'}
              onValueChange={(value) => setSelectedProject(value === 'all' ? null : parseInt(value))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={() => setShowAddDevice(true)}
              className="bg-burgundy hover:bg-burgundy/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Device
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : devices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No devices found
                  </TableCell>
                </TableRow>
              ) : (
                devices?.map((device) => (
                  <TableRow
                    key={device.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setEditDevice(device)}
                  >
                    <TableCell className="font-mono">{device.serial_number}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{device.device_model}</TableCell>
                    <TableCell>
                      {projects.find(p => p.id === device.project_id)?.name || '-'}
                    </TableCell>
                    <TableCell>{formatLastSeen(device.last_used_at)}</TableCell>
                    <TableCell>{getStatusBadge(device)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <DeviceForm
        open={showAddDevice || !!editDevice}
        onClose={() => {
          setShowAddDevice(false);
          setEditDevice(undefined);
        }}
        device={editDevice}
        projects={projects}
        onSuccess={() => {
          setShowAddDevice(false);
          setEditDevice(undefined);
        }}
      />
    </main>
  );
}
