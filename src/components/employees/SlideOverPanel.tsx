
'use client';

import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Employee } from '@/types/employee';
import EmployeeForm from './EmployeeForm';
import EmployeeDetails from './EmployeeDetails';

interface SlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  // Form veya detay panelinden "kaydet/düzenle"ye basıldığında çağrılır.
  // Payload akışa göre değişir (formData veya Employee), parent yalnızca tetiklenmeyi
  // kullandığı için type'ı geniş tutuyoruz.
  onSave: (payload?: unknown) => void;
  viewMode?: boolean;
}

export default function SlideOverPanel({
  isOpen,
  onClose,
  employee,
  onSave,
  viewMode = false
}: SlideOverPanelProps) {
  const formEmployee = useMemo(() => {
    if (!employee) return null;
    return {
      ...employee,
      department: employee.departments?.name || '',
      position: employee.positions?.name || '',
    };
  }, [employee]);

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
                employee={formEmployee}
                onClose={onClose}
                onSave={(employee) => onSave(employee)}
              />
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
