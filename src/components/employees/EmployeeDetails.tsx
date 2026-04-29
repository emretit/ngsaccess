
import { Employee } from '@/types/employee';
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Edit2, Mail } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from 'date-fns';

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
            <AvatarImage src={employee.photoUrl || ''} alt={`${employee.firstName} ${employee.lastName}`} />
            <AvatarFallback className="text-xl">
              {employee.firstName?.[0]}{employee.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-medium text-lg">{employee.firstName} {employee.lastName}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <Mail className="h-3 w-3" /> {employee.email}
            </p>
            <div className="mt-1">
              <Badge variant={employee.isActive ? "success" : "secondary"}>
                {employee.isActive ? 'Aktif' : 'Pasif'}
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Kişisel Bilgiler</h4>
          <DetailItem label="TC No" value={employee.tcNo} />
          <DetailItem label="Kart No" value={employee.cardNumber} />
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">İş Bilgileri</h4>
          <DetailItem label="Departman" value={employee.departments?.name || '-'} />
          <DetailItem label="Pozisyon" value={employee.positions?.name || '-'} />
          <DetailItem label="Vardiya" value={employee.shift || '-'} />
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-medium">Sistem Bilgileri</h4>
        <div className="grid grid-cols-2 gap-4">
          <DetailItem
            label="Oluşturulma Tarihi"
            value={employee.createdAt ? format(new Date(employee.createdAt), 'dd.MM.yyyy HH:mm') : '-'}
          />
          <DetailItem
            label="Son Güncelleme"
            value={employee.updatedAt ? format(new Date(employee.updatedAt), 'dd.MM.yyyy HH:mm') : '-'}
          />
        </div>
      </div>

      {employee.notes && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">Notlar</h4>
            <div className="text-sm p-3 bg-muted rounded-md">
              {employee.notes}
            </div>
          </div>
        </>
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
