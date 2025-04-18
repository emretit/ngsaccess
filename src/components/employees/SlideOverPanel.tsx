
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Employee } from '@/types/employee';
import EmployeeForm from './EmployeeForm';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (employee: Employee) => void;
}

export default function SlideOverPanel({ 
  isOpen, 
  onClose, 
  employee, 
  onSave 
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
            {employee ? 'Personel Düzenle' : 'Yeni Personel'}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          <EmployeeForm
            employee={mapEmployeeToFormData(employee)}
            onClose={onClose}
            onSave={onSave}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
