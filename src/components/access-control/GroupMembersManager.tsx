
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccessRule, GroupMember } from "@/types/access-control";
import { useEmployees } from "@/hooks/useEmployees";
import { useAccessRules } from "@/hooks/useAccessRules";

interface GroupMembersManagerProps {
  rule: AccessRule;
  projectId?: number;
}

export function GroupMembersManager({ rule, projectId }: GroupMembersManagerProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  
  const { employees } = useEmployees(projectId);
  const { addGroupMember, removeGroupMember } = useAccessRules(projectId);

  const filteredEmployees = employees?.filter(emp => 
    `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const availableEmployees = filteredEmployees.filter(emp => 
    !rule.group_members?.some(member => member.employee_id === emp.id)
  );

  const handleAddMember = () => {
    if (selectedEmployeeId) {
      addGroupMember.mutate({
        groupId: rule.id,
        employeeId: parseInt(selectedEmployeeId),
        projectId
      });
      setSelectedEmployeeId("");
    }
  };

  const handleRemoveMember = (memberId: number) => {
    removeGroupMember.mutate(memberId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Grup Üyeleri
          <Badge variant="secondary">{rule.group_members?.length || 0}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new member */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="Çalışan ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-2"
            />
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Çalışan seçin" />
              </SelectTrigger>
              <SelectContent>
                {availableEmployees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    {employee.first_name} {employee.last_name}
                    {employee.email && ` (${employee.email})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleAddMember}
            disabled={!selectedEmployeeId || addGroupMember.isPending}
            className="mt-8"
          >
            <Plus className="w-4 h-4 mr-1" />
            Ekle
          </Button>
        </div>

        {/* Current members */}
        <div className="space-y-2">
          {rule.group_members?.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium">
                  {member.employees?.first_name} {member.employees?.last_name}
                </div>
                {member.employees?.email && (
                  <div className="text-sm text-muted-foreground">
                    {member.employees.email}
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveMember(member.id)}
                disabled={removeGroupMember.isPending}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )) || (
            <div className="text-center text-muted-foreground py-4">
              Bu gruba henüz çalışan eklenmemiş
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
