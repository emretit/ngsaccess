
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Department } from "@/types/department";
import { Employee } from "@/types/employee";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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
  onChange: (selection: DepartmentEmployeeSelection[]) => void;
  value: DepartmentEmployeeSelection[];
}

function buildTree(departments: Department[], employees: Employee[]): TreeDepartment[] {
  const employeesByDept: { [depId: number]: Employee[] } = {};
  employees.forEach(emp => {
    if (typeof emp.department_id === "number" && emp.department_id !== null) {
      if (!employeesByDept[emp.department_id]) employeesByDept[emp.department_id] = [];
      employeesByDept[emp.department_id].push(emp);
    }
  });

  const idToNode: { [id: number]: TreeDepartment } = {};
  departments.forEach(dept => {
    idToNode[dept.id] = { ...dept, children: [], employees: employeesByDept[dept.id] || [] };
  });

  const roots: TreeDepartment[] = [];
  departments.forEach(dept => {
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<{ [id: number]: boolean }>({});

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

    if (!error) setDepartments(data || []);
  }

  async function fetchEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("first_name", { ascending: true });

    if (!error) setEmployees((data as Employee[]) || []);
  }

  const tree = buildTree(departments, employees);

  // Seçili mi?
  function isDeptChecked(dept: Department): boolean {
    return !!value.find(v => v.type === "department" && v.id === dept.id);
  }
  function isEmployeeChecked(emp: Employee): boolean {
    return !!value.find(v => v.type === "employee" && v.id === emp.id);
  }

  function handleDeptToggle(dept: TreeDepartment) {
    let newValue: DepartmentEmployeeSelection[];
    if (isDeptChecked(dept)) {
      // kaldır: departman ve onun tüm çalışanları selection'dan çıkar
      newValue = value.filter(
        v =>
          !(
            (v.type === "department" && v.id === dept.id) ||
            (v.type === "employee" && dept.employees.some(e => e.id === v.id))
          )
      );
    } else {
      // ekle: departmanı ekle, çalışanları ekleme (kullanıcı isterse ayrıca işaretler)
      newValue = [...value, { type: "department", id: dept.id, name: dept.name }];
    }
    onChange(newValue);
  }

  function handleEmployeeToggle(emp: Employee, dept: TreeDepartment) {
    let newValue: DepartmentEmployeeSelection[];
    if (isEmployeeChecked(emp)) {
      newValue = value.filter(v => !(v.type === "employee" && v.id === emp.id));
    } else {
      newValue = [
        ...value,
        { type: "employee", id: emp.id, name: emp.first_name + " " + emp.last_name }
      ];
    }
    onChange(newValue);
  }

  // ikon tıklayınca altı aç/kapat
  function toggleExpandDept(deptId: number) {
    setExpandedDepts(exp => ({ ...exp, [deptId]: !exp[deptId] }));
  }

  // arayüz örnek gibi padding ve çizgi ile hiyerarşi
  function renderTree(nodes: TreeDepartment[], level = 0) {
    return nodes.map(node => (
      <div key={`dept-${node.id}`}>
        <div className={cn(
          "flex items-center gap-2 py-2",
          level === 0 ? "font-semibold text-lg" : "font-semibold text-base"
        )}>
          <Checkbox
            checked={isDeptChecked(node)}
            onCheckedChange={() => handleDeptToggle(node)}
            id={`dept-checkbox-${node.id}`}
          />
          <label htmlFor={`dept-checkbox-${node.id}`} className="cursor-pointer">
            {node.name}
          </label>
        </div>
        <div className="pl-7">
          {node.employees.map((emp) => (
            <div key={`emp-${emp.id}`} className="flex items-center gap-2 py-1">
              <div className="border-l h-full mr-3" style={{ minHeight: "18px" }} />
              <Checkbox
                checked={isEmployeeChecked(emp)}
                onCheckedChange={() => handleEmployeeToggle(emp, node)}
                id={`emp-checkbox-${emp.id}`}
              />
              <label htmlFor={`emp-checkbox-${emp.id}`} className="cursor-pointer">
                {emp.first_name} {emp.last_name}
              </label>
            </div>
          ))}
          {/* Alt departmanları göster */}
          {node.children.length > 0 && renderTree(node.children, level + 1)}
        </div>
      </div>
    ));
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 max-w-md max-h-[400px] overflow-y-auto">
      {renderTree(tree)}
    </div>
  );
}

