
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Project } from '@/types/device';

interface ServerDeviceFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedProject: number | null;
  onProjectChange: (value: string) => void;
  selectedModel: "QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other" | null;
  onModelChange: (value: string) => void;
  projects: Project[];
  deviceModels: readonly ("QR Reader" | "Fingerprint Reader" | "RFID Reader" | "Access Control Terminal" | "Other")[];
}

export function ServerDeviceFilters({
  search,
  onSearchChange,
  selectedProject,
  onProjectChange,
  selectedModel,
  onModelChange,
  projects,
  deviceModels
}: ServerDeviceFiltersProps) {
  return (
    <div className="flex gap-4 items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <Input
          placeholder="Search by serial number or name..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Select
        value={selectedProject?.toString() || 'all'}
        onValueChange={onProjectChange}
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
        onValueChange={onModelChange}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="All Models" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Models</SelectItem>
          {deviceModels.map(model => (
            <SelectItem key={model} value={model}>
              {model}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
