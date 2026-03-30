// @ts-nocheck

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Clock } from "lucide-react";

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  breakDuration: string;
  lunchBreakStart: string;
  lunchBreakEnd: string;
  isActive: boolean;
}

interface ShiftTableProps {
  shifts: Shift[];
  onEdit: (shift: Shift) => void;
  onDelete: (shiftId: number) => void;
}

export function ShiftTable({ shifts, onEdit, onDelete }: ShiftTableProps) {
  const formatTime = (time: string) => {
    return time;
  };

  const getLunchBreakDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const duration = endMinutes - startMinutes;
    return `${duration} dk`;
  };

  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Henüz vardiya tanımlanmamış</h3>
        <p className="text-gray-500">İlk vardiyayı eklemek için yukarıdaki butonu kullanın</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold text-gray-700">Vardiya Adı</TableHead>
            <TableHead className="font-semibold text-gray-700">Başlangıç Saati</TableHead>
            <TableHead className="font-semibold text-gray-700">Bitiş Saati</TableHead>
            <TableHead className="font-semibold text-gray-700">Mola Süresi</TableHead>
            <TableHead className="font-semibold text-gray-700">Öğle Molası</TableHead>
            <TableHead className="font-semibold text-gray-700">Durum</TableHead>
            <TableHead className="font-semibold text-gray-700 text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift, index) => (
            <TableRow 
              key={shift.id} 
              className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}
            >
              <TableCell className="font-medium text-gray-900">
                {shift.name}
              </TableCell>
              <TableCell className="text-gray-700">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {formatTime(shift.startTime)}
                </div>
              </TableCell>
              <TableCell className="text-gray-700">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {formatTime(shift.endTime)}
                </div>
              </TableCell>
              <TableCell className="text-gray-700">
                {shift.breakDuration} dakika
              </TableCell>
              <TableCell className="text-gray-700">
                <div className="text-sm">
                  <div>{formatTime(shift.lunchBreakStart)} - {formatTime(shift.lunchBreakEnd)}</div>
                  <div className="text-gray-500 text-xs">
                    ({getLunchBreakDuration(shift.lunchBreakStart, shift.lunchBreakEnd)})
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge 
                  variant={shift.isActive ? "default" : "secondary"}
                  className={shift.isActive ? "bg-green-100 text-green-800" : ""}
                >
                  {shift.isActive ? "Aktif" : "Pasif"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(shift)}
                    className="hover:bg-blue-50 hover:border-blue-300"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(shift.id)}
                    className="hover:bg-red-50 hover:border-red-300 text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
