import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

import { FolderTree } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface DepartmentTreeProps {
  onSelectDepartment: (id: number | null) => void;
}

export default function DepartmentTree({ onSelectDepartment }: DepartmentTreeProps) {
  const departments = useQuery(api.departments.list) ?? [];
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const handleDepartmentClick = (id: string) => {
    const newSelectedId = selectedDepartment === id ? null : id;
    setSelectedDepartment(newSelectedId);
    onSelectDepartment(newSelectedId as unknown as number | null);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center gap-2">
        <FolderTree className="h-4 w-4" />
        Departmanlar
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {departments.map((dept: { _id: string; name: string; level?: number }) => (
            <SidebarMenuItem key={dept._id}>
              <SidebarMenuButton
                onClick={() => handleDepartmentClick(dept._id)}
                className={cn(
                  "w-full",
                  selectedDepartment === dept._id && "bg-burgundy/10 text-burgundy"
                )}
                style={{ marginLeft: `${(dept.level ?? 0) * 12}px` }}
              >
                {dept.name}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
