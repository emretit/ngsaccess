
'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
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
      <SheetContent size="md" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>
              {viewMode ? 'Personel Detayları' : (employee ? 'Personel Düzenle' : 'Yeni Personel')}
            </SheetTitle>
          </SheetHeader>
        </div>
        
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-6">
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
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
