import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ShiftTable } from "./components/ShiftTable";
import { AddShiftDialog } from "./components/AddShiftDialog";

// Mock data for shifts - in real app this would come from database
const mockShifts = [
  {
    id: 1,
    name: "Sabah Vardiyası",
    startTime: "08:00",
    endTime: "16:00",
    breakDuration: "15",
    lunchBreakStart: "12:00",
    lunchBreakEnd: "13:00",
    isActive: true,
  },
  {
    id: 2,
    name: "Akşam Vardiyası",
    startTime: "16:00",
    endTime: "00:00",
    breakDuration: "15",
    lunchBreakStart: "20:00",
    lunchBreakEnd: "21:00",
    isActive: true,
  },
  {
    id: 3,
    name: "Gece Vardiyası",
    startTime: "00:00",
    endTime: "08:00",
    breakDuration: "15",
    lunchBreakStart: "04:00",
    lunchBreakEnd: "05:00",
    isActive: true,
  },
];

interface ShiftSettingsProps {
  onComplete?: () => void;
}

export function ShiftSettings({ onComplete }: ShiftSettingsProps) {
  const [shifts, setShifts] = useState(mockShifts);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);

  const handleAddShift = (newShift: any) => {
    const shift = {
      ...newShift,
      id: Date.now(), // In real app, this would be handled by database
      isActive: true,
    };
    setShifts([...shifts, shift]);
    setIsAddDialogOpen(false);
    
    // Call completion callback when first shift is added
    if (onComplete && shifts.length === 0) {
      onComplete();
    }
  };

  const handleEditShift = (shift: any) => {
    setEditingShift(shift);
    setIsAddDialogOpen(true);
  };

  const handleUpdateShift = (updatedShift: any) => {
    setShifts(shifts.map(shift => 
      shift.id === updatedShift.id ? updatedShift : shift
    ));
    setEditingShift(null);
    setIsAddDialogOpen(false);
  };

  const handleDeleteShift = (shiftId: number) => {
    setShifts(shifts.filter(shift => shift.id !== shiftId));
  };

  const handleCloseDialog = () => {
    setIsAddDialogOpen(false);
    setEditingShift(null);
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vardiya Ayarları</h1>
          <p className="text-gray-600 mt-2">Çalışma vardiyalarını yönetin ve düzenleyin</p>
        </div>
        <Button 
          onClick={() => setIsAddDialogOpen(true)}
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yeni Vardiya Ekle
        </Button>
      </div>

      <Card className="shadow-md">
        <CardHeader className="bg-white border-b border-gray-200">
          <CardTitle className="text-xl text-gray-800">Mevcut Vardiyalar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ShiftTable 
            shifts={shifts}
            onEdit={handleEditShift}
            onDelete={handleDeleteShift}
          />
        </CardContent>
      </Card>

      <AddShiftDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onAdd={handleAddShift}
        onUpdate={handleUpdateShift}
        editingShift={editingShift}
        onClose={handleCloseDialog}
      />
    </div>
  );
}
