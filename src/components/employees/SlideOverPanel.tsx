
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Employee } from '@/types/employee';
import EmployeeForm from './EmployeeForm';
import EmployeeDetails from './EmployeeDetails';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (employee: Employee) => void;
  viewMode?: boolean;
}

export default function SlideOverPanel({ 
  isOpen, 
  onClose, 
  employee, 
  onSave,
  viewMode = false
}: SlideOverPanelProps) {
  const mapEmployeeToFormData = (emp: Employee | null) => {
    if (!emp) return null;
    return {
      ...emp,
      department: emp.departments?.name || '',
      position: emp.positions?.name || ''
    };
  };

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {viewMode ? 'Personel Detayları' : (employee ? 'Personel Düzenle' : 'Yeni Personel')}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          {viewMode ? (
            <EmployeeDetails employee={employee} onEdit={() => onSave(employee!)} />
          ) : (
            <EmployeeForm
              employee={mapEmployeeToFormData(employee)}
              onClose={onClose}
              onSave={onSave}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
