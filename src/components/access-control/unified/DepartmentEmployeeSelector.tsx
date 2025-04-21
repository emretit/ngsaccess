
import { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
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

interface TreeDepartment extends Department {
  children: TreeDepartment[];
  employees: Employee[];
}

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

interface DepartmentEmployeeSelectorProps {
  onChange: (selection: DepartmentEmployeeSelection | null) => void;
  value: DepartmentEmployeeSelection | null;
}

function buildTree(
  departments: Department[],
  employees: Employee[]
): TreeDepartment[] {
  // departman id -> employees list
  const employeesByDept: { [depId: number]: Employee[] } = {};
  employees.forEach((emp) => {
    if (typeof emp.department_id === "number") {
      if (!employeesByDept[emp.department_id]) employeesByDept[emp.department_id] = [];
      employeesByDept[emp.department_id].push(emp);
    }
  });

  // build tree node map
  const idToNode: { [id: number]: TreeDepartment } = {};
  departments.forEach((dept) => {
    idToNode[dept.id] = { ...dept, children: [], employees: employeesByDept[dept.id] || [] };
  });

  // Build top-level tree and assign children
  const roots: TreeDepartment[] = [];
  departments.forEach((dept) => {
    if (dept.parent_id !== null && idToNode[dept.parent_id]) {
      idToNode[dept.parent_id].children.push(idToNode[dept.id]);
    } else {
      roots.push(idToNode[dept.id]);
    }
  });

  return roots;
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
    // employees tablosunda department_id numeric, tüm alanlar gelsin
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("first_name", { ascending: true });

    if (error) {
      console.error("Error fetching employees:", error);
      return;
    }

    setEmployees((data as Employee[]) || []);
  }

  const tree = buildTree(departments, employees);

  // Aramaya göre filtreleme (departman adı, çalışan adı)
  function filterTree(
    nodes: TreeDepartment[],
    query: string
  ): TreeDepartment[] {
    if (!query) return nodes;

    const q = query.toLowerCase();
    return nodes
      .map((node) => {
        // departman eşleşiyorsa veya altı/çalışanı eşleşiyorsa göster
        const matchesDept = node.name.toLowerCase().includes(q);
        const filteredEmployees = node.employees.filter(
          (emp) =>
            emp.first_name.toLowerCase().includes(q) ||
            emp.last_name.toLowerCase().includes(q)
        );
        const filteredChildren = filterTree(node.children, query);

        if (matchesDept || filteredEmployees.length > 0 || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
            employees: filteredEmployees,
          };
        }
        return null;
      })
      .filter(Boolean) as TreeDepartment[];
  }

  // recursive render
  const renderTree = (nodes: TreeDepartment[], level = 0) =>
    nodes.map((node) => (
      <div key={`dept-${node.id}`}>
        <CommandItem
          onSelect={() => handleSelect("department", node.id, node.name)}
          className="flex items-center"
          style={{ paddingLeft: `${level * 18 + 12}px`, fontWeight: 500 }}
        >
          <Folder className="mr-2 h-4 w-4" />
          <span>{node.name}</span>
          {value?.type === "department" && value?.id === node.id && (
            <Check className="ml-auto h-4 w-4" />
          )}
        </CommandItem>

        {/* Çalışanları göster */}
        {node.employees.map((emp) => (
          <CommandItem
            key={`emp-${emp.id}`}
            onSelect={() =>
              handleSelect("employee", emp.id, `${emp.first_name} ${emp.last_name}`)
            }
            className="flex items-center"
            style={{ paddingLeft: `${level * 18 + 36}px`, fontWeight: 400 }}
          >
            <User className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>
              {emp.first_name} {emp.last_name}
            </span>
            {value?.type === "employee" && value?.id === emp.id && (
              <Check className="ml-auto h-4 w-4" />
            )}
          </CommandItem>
        ))}

        {/* Alt departmanları tree olarak göster */}
        {node.children.length > 0 && renderTree(node.children, level + 1)}
      </div>
    ));

  const handleSelect = (type: "department" | "employee", id: number, name: string) => {
    onChange({ type, id, name });
    setOpen(false);
  };

  // Tüm departman + altındaki çalışanları tree olarak göster
  const filteredTree = filterTree(tree, search);

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
      <PopoverContent
        className="p-0"
        align="start"
        sideOffset={5}
        style={{ width: "var(--radix-popover-trigger-width)" }}
      >
        <Command>
          <CommandInput
            placeholder="Ara..."
            onValueChange={setSearch}
            value={search}
          />
          <CommandList className="max-h-[360px]">
            <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
            {renderTree(filteredTree)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

