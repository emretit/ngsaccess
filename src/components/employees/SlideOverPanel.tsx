
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Employee } from '@/types/employee';
import EmployeeForm from './EmployeeForm';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (employee: any) => void;
}

export default function SlideOverPanel({ 
  isOpen, 
  onClose, 
  employee, 
  onSave 
}: SlideOverPanelProps) {
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
            employee={employee}
            onClose={onClose}
            onSave={onSave}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
