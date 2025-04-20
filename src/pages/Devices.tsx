
import { useState } from 'react';
import { format } from 'date-fns';
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDevices } from "@/hooks/useDevices";
import { DeviceForm } from "@/components/devices/DeviceForm";
import { ServerDevice } from "@/types/device";

// For demo purposes, we're using a hardcoded project ID
// In a real application, this would come from authentication context
const DEMO_PROJECT_ID = 1;

export default function Devices() {
  const [searchTerm, setSearchTerm] = useState('');
  const { devices, isLoading, addDevice, isAddingDevice } = useDevices(DEMO_PROJECT_ID);

  // Filter devices based on search term
  const filteredDevices = devices.filter((device: ServerDevice) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      device.name?.toLowerCase().includes(searchLower) ||
      device.serial_number?.toLowerCase().includes(searchLower) ||
      device.device_model_enum?.toLowerCase().includes(searchLower)
    );
  });

  // Function to render status badge with appropriate color
  const renderStatusBadge = (status?: string) => {
    if (status === 'online') {
      return <Badge className="bg-green-500">Online</Badge>;
    } else if (status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    } else {
      return <Badge variant="outline" className="bg-gray-200 text-gray-700">Offline</Badge>;
    }
  };

  return (
    <main className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Project Devices</h1>
          <DeviceForm onAddDevice={addDevice} isLoading={isAddingDevice} />
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search by name, serial number or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Serial Number</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6">
                    Loading devices...
                  </TableCell>
                </TableRow>
              ) : filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-gray-500">
                    {searchTerm
                      ? "No devices match your search criteria"
                      : "No devices found in this project. Add your first device!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device: ServerDevice) => (
                  <TableRow key={device.id}>
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono">{device.serial_number}</TableCell>
                    <TableCell>{device.device_model_enum}</TableCell>
                    <TableCell>
                      {device.date_added
                        ? format(new Date(device.date_added), 'MMM d, yyyy')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {device.expiry_date
                        ? format(new Date(device.expiry_date), 'MMM d, yyyy')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>{renderStatusBadge(device.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
