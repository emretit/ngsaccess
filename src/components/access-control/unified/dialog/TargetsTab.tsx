import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useDepartments } from "@/hooks/useDepartments";
import type { Department } from "@/hooks/useDepartments";
import { useEmployees } from "@/hooks/useEmployees";
import { Building2, Loader2, Shield, Users } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { EnhancedRuleFormData } from "./useEnhancedRuleForm";

interface TargetsTabProps {
  formData: EnhancedRuleFormData;
  setFormData: Dispatch<SetStateAction<EnhancedRuleFormData>>;
}

export function TargetsTab({ formData, setFormData }: TargetsTabProps) {
  const { employees, isLoading: employeesLoading } = useEmployees();
  const { departments, isLoading: departmentsLoading } = useDepartments();

  const renderTargetSelection = () => {
    switch (formData.targetType) {
      case "individual":
        return (
          <div className="space-y-3">
            <Label>Çalışanlar</Label>
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {employeesLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : employees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Çalışan yok
                </p>
              ) : (
                employees.map((employee) => (
                  <div key={employee._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`employee-${employee._id}`}
                      checked={formData.selectedEmployees.includes(employee._id)}
                      onCheckedChange={(checked) => {
                        setFormData((prev) => ({
                          ...prev,
                          selectedEmployees: checked
                            ? [...prev.selectedEmployees, employee._id]
                            : prev.selectedEmployees.filter(
                                (id) => id !== employee._id
                              ),
                        }));
                      }}
                    />
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <Label
                      htmlFor={`employee-${employee._id}`}
                      className="text-sm cursor-pointer"
                    >
                      {employee.firstName} {employee.lastName}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "department":
        return (
          <div className="space-y-3">
            <Label>Departmanlar</Label>
            <div className="border rounded-lg p-3 max-h-60 overflow-y-auto space-y-2">
              {departmentsLoading ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Yükleniyor...
                </div>
              ) : departments.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">
                  Departman yok
                </p>
              ) : (
                (departments as Department[]).map((department) => (
                  <div key={department._id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dept-${department._id}`}
                      checked={formData.selectedEmployees.includes(department._id)}
                      onCheckedChange={(checked) => {
                        const deptEmployees = employees.filter(
                          (emp) => emp.departmentId === department._id
                        );
                        const employeeIds = deptEmployees.map((emp) => String(emp._id));

                        setFormData((prev) => ({
                          ...prev,
                          selectedEmployees: checked
                            ? [...new Set([...prev.selectedEmployees, ...employeeIds])]
                            : prev.selectedEmployees.filter(
                                (id) => !employeeIds.includes(id)
                              ),
                        }));
                      }}
                    />
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <Label
                      htmlFor={`dept-${department._id}`}
                      className="text-sm cursor-pointer"
                    >
                      {department.name}
                    </Label>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "all":
        return (
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <span className="font-medium">Tüm Çalışanlar</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Bu kural tüm çalışanlar için geçerli olacaktır.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Hedef Seçimi</span>
        </CardTitle>
        <CardDescription>
          Bu kural hangi çalışanlar için geçerli olacak?
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderTargetSelection()}

        {formData.selectedEmployees.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Badge variant="secondary">
                {formData.selectedEmployees.length} çalışan seçildi
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
