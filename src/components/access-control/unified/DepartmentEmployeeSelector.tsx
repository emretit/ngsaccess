
import { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, User, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Department } from "@/types/department";
import { Employee } from "@/types/employee";

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

interface DepartmentEmployeeSelectorProps {
  onChange: (selection: DepartmentEmployeeSelection | null) => void;
  value: DepartmentEmployeeSelection | null;
}

export default function DepartmentEmployeeSelector({
  onChange,
  value,
}: DepartmentEmployeeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
  }, []);

  async function fetchDepartments() {
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("level", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching departments:", error);
      return;
    }

    setDepartments(data || []);
  }

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("*, departments(name)")
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching employees:", error);
      return;
    }

    setEmployees(data || []);
  }

  const filteredDepartments = departments.filter((dept) =>
    dept.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.first_name.toLowerCase().includes(search.toLowerCase()) ||
      emp.last_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (type: "department" | "employee", id: number, name: string) => {
    onChange({ type, id, name });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between w-full"
        >
          {value ? (
            <div className="flex items-center">
              {value.type === "department" ? (
                <Folder className="mr-2 h-4 w-4" />
              ) : (
                <User className="mr-2 h-4 w-4" />
              )}
              <span>{value.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Departman veya kişi seçin</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start" sideOffset={5} style={{ width: "var(--radix-popover-trigger-width)" }}>
        <Command>
          <CommandInput 
            placeholder="Ara..." 
            onValueChange={setSearch}
            value={search}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
            <CommandGroup heading="Departmanlar">
              {filteredDepartments.map((dept) => (
                <CommandItem
                  key={`dept-${dept.id}`}
                  onSelect={() => handleSelect("department", dept.id, dept.name)}
                  className="flex items-center"
                  style={{ paddingLeft: `${(dept.level || 0) * 12 + 16}px` }}
                >
                  <Folder className="mr-2 h-4 w-4" />
                  <span>{dept.name}</span>
                  {value?.type === "department" && 
                   value?.id === dept.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Personeller">
              {filteredEmployees.map((emp) => (
                <CommandItem
                  key={`emp-${emp.id}`}
                  onSelect={() => 
                    handleSelect(
                      "employee", 
                      emp.id, 
                      `${emp.first_name} ${emp.last_name}`
                    )
                  }
                  className="flex items-center"
                >
                  <User className="mr-2 h-4 w-4" />
                  <span>{emp.first_name} {emp.last_name}</span>
                  {emp.departments?.name && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({emp.departments.name})
                    </span>
                  )}
                  {value?.type === "employee" && 
                   value?.id === emp.id && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
