
import { useState } from 'react';
import { Plus } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ServerDevice } from '@/types/device';
import { ServerDeviceForm } from '@/components/devices/ServerDeviceForm';
import { ServerDeviceTable } from '@/components/devices/ServerDeviceTable';
import { ServerDeviceFilters } from '@/components/devices/ServerDeviceFilters';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

const PAGE_SIZE = 10;
const DEVICE_MODEL_TYPES = [
  "QR Reader", "Fingerprint Reader", "RFID Reader", "Access Control Terminal", "Other"
] as const;

export default function ServerDevices() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<typeof DEVICE_MODEL_TYPES[number] | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [editDevice, setEditDevice] = useState<ServerDevice | null>(null);

  // Fetch projects for filter
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('*');
      return data || [];
    },
  });

  // Fetch devices with filters
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

        <ServerDeviceFilters
          search={search}
          onSearchChange={setSearch}
          selectedProject={selectedProject}
          onProjectChange={(value) => setSelectedProject(value === 'all' ? null : parseInt(value))}
          selectedModel={selectedModel}
          onModelChange={(value) => setSelectedModel(value === 'all' ? null : value as typeof selectedModel)}
          projects={projects}
          deviceModels={DEVICE_MODEL_TYPES}
        />

        <ServerDeviceTable
          devices={devices?.data || []}
          isLoading={isLoading}
          onDeviceClick={setEditDevice}
        />

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
