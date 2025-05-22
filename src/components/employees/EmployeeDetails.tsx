
import { Employee } from '@/types/employee';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Edit2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EmployeeDetailProps {
  employee: Employee | null;
  onEdit: () => void;
}

export default function EmployeeDetails({ employee, onEdit }: EmployeeDetailProps) {
  if (!employee) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20">
            <AvatarImage src={employee.photo_url || ''} alt={`${employee.first_name} ${employee.last_name}`} />
            <AvatarFallback className="text-xl">
              {employee.first_name?.[0]}{employee.last_name?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-lg">{employee.first_name} {employee.last_name}</h3>
            <p className="text-sm text-muted-foreground">{employee.email}</p>
            <div className="mt-1">
              <Badge variant={employee.is_active ? "success" : "secondary"}>
                {employee.is_active ? 'Aktif' : 'Pasif'}
              </Badge>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit2 className="h-4 w-4 mr-2" />
          Düzenle
        </Button>
      </div>

      <Separator />

      <div className="space-y-3">
        <DetailItem label="TC No" value={employee.tc_no} />
        <DetailItem label="Kart No" value={employee.card_number} />
        <DetailItem label="Departman" value={employee.departments?.name || '-'} />
        <DetailItem label="Pozisyon" value={employee.positions?.name || '-'} />
        <DetailItem label="Vardiya" value={employee.shift || '-'} />
        <DetailItem 
          label="Erişim İzni" 
          value={employee.access_permission ? 'Var' : 'Yok'} 
          valueClass={employee.access_permission ? 'text-green-600' : 'text-red-600'} 
        />
      </div>

      <Separator />

      {employee.notes && (
        <div>
          <h4 className="text-sm font-medium mb-2">Notlar</h4>
          <div className="text-sm p-3 bg-muted rounded-md">
            {employee.notes}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({ 
  label, 
  value, 
  valueClass = '' 
}: { 
  label: string; 
  value: string | number | null | undefined; 
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className={`text-sm font-medium ${valueClass}`}>{value || '-'}</span>
    </div>
  );
}
