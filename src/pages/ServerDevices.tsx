import { useState } from 'react';
import { ChevronDown, Plus, Search } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from '@tanstack/react-query';
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice } from '@/types/device';
import { ServerDeviceForm } from '@/components/devices/ServerDeviceForm';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

const PAGE_SIZE = 10;
const DEVICE_MODEL_TYPES: ("QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other")[] = [
  "QR Reader", "Fingerprint Reader", "RFID Reader", "Access Control Terminal", "Other"
];

export default function ServerDevices() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<"QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other" | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editDevice, setEditDevice] = useState<ServerDevice | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*');
      return data || [];
    },
  });

  const { data: devices, isLoading } = useQuery({
    queryKey: ['server-devices', page, search, selectedProject, selectedModel],
    queryFn: async () => {
      let query = supabase
        .from('server_devices')
        .select('*, projects(name)', { count: 'exact' });

      if (search) {
        query = query.or(`serial_number.ilike.%${search}%,name.ilike.%${search}%`);
      }
      if (selectedProject) {
        query = query.eq('project_id', selectedProject);
      }
      if (selectedModel) {
        query = query.eq('device_model_enum', selectedModel);
      }

      const start = (page - 1) * PAGE_SIZE;
      query = query.range(start, start + PAGE_SIZE - 1);

      const { data, count } = await query;
      return { data: (data || []) as ServerDevice[], count: count || 0 };
    },
  });

  const totalPages = Math.ceil((devices?.count || 0) / PAGE_SIZE);

  return (
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Server Devices Management</h1>
          
          <Button
            onClick={() => setShowAddDevice(true)}
            className="bg-burgundy hover:bg-burgundy/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Device
          </Button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search by serial number or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

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

          <Select
            value={selectedModel || 'all'}
            onValueChange={(value) => setSelectedModel(value === 'all' ? null : value as "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Models" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Models</SelectItem>
              {DEVICE_MODEL_TYPES.map(model => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Serial Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Expiry Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : devices?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No devices found
                  </TableCell>
                </TableRow>
              ) : (
                devices?.data.map((device) => (
                  <TableRow
                    key={device.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setEditDevice(device)}
                  >
                    <TableCell className="font-mono">{device.serial_number}</TableCell>
                    <TableCell>{device.name}</TableCell>
                    <TableCell>{device.device_model_enum}</TableCell>
                    <TableCell>{device.projects?.name || '-'}</TableCell>
                    <TableCell>{format(new Date(device.date_added), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      {device.expiry_date 
                        ? format(new Date(device.expiry_date), 'MMM d, yyyy')
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            <PaginationItem>
              Page {page} of {totalPages}
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      <ServerDeviceForm
        open={showAddDevice || !!editDevice}
        onClose={() => {
          setShowAddDevice(false);
          setEditDevice(null);
        }}
        device={editDevice}
        projects={projects}
        onSuccess={() => {
          setShowAddDevice(false);
          setEditDevice(null);
        }}
      />
    </main>
  );
}
