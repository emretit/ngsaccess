import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Clock, Plus } from "lucide-react";
import type { Id } from "../../../../../convex/_generated/dataModel";

export interface ShiftRow {
  _id: Id<"shifts">;
  name: string;
  startTime: string;
  endTime: string;
  breakStart?: string;
  breakEnd?: string;
  lateToleranceMinutes?: number;
  earlyExitToleranceMinutes?: number;
  overtimeStartToleranceMinutes?: number;
  overtimeEnabled?: boolean;
  isActive?: boolean;
}

interface ShiftTableProps {
  shifts: ShiftRow[];
  onEdit: (shift: ShiftRow) => void;
  onDelete: (shiftId: Id<"shifts">) => void;
  onAdd?: () => void;
}

function getBreakDuration(start?: string, end?: string): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let duration = eh * 60 + em - (sh * 60 + sm);
  if (duration < 0) duration += 24 * 60;
  return `${duration} dk`;
}

export function ShiftTable({ shifts, onEdit, onDelete, onAdd }: ShiftTableProps) {
  if (shifts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <Clock className="w-12 h-12 text-muted-foreground/70 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Henüz vardiya tanımlanmamış</h3>
        <p className="text-muted-foreground mb-5 max-w-sm">
          Çalışanlarınıza atama yapabilmek için önce çalışma saatlerini tanımlayın.
        </p>
        {onAdd && (
          <Button onClick={onAdd}>
            <Plus className="mr-1.5 h-4 w-4" />
            İlk Vardiyayı Ekle
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold text-foreground">Vardiya Adı</TableHead>
            <TableHead className="font-semibold text-foreground">Başlangıç Saati</TableHead>
            <TableHead className="font-semibold text-foreground">Bitiş Saati</TableHead>
            <TableHead className="font-semibold text-foreground">Mola Aralığı</TableHead>
            <TableHead className="font-semibold text-foreground">Mesai</TableHead>
            <TableHead className="font-semibold text-foreground">Durum</TableHead>
            <TableHead className="font-semibold text-foreground text-right">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shifts.map((shift, index) => {
            const isActive = shift.isActive ?? true;
            const overtimeOn = shift.overtimeEnabled ?? true;
            return (
              <TableRow
                key={shift._id}
                className={`${index % 2 === 0 ? "bg-card" : "bg-muted/50"} hover:bg-muted transition-colors`}
              >
                <TableCell className="font-medium text-foreground">{shift.name}</TableCell>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground/70" />
                    {shift.startTime}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4 text-muted-foreground/70" />
                    {shift.endTime}
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {shift.breakStart && shift.breakEnd ? (
                    <div className="text-sm">
                      <div>
                        {shift.breakStart} - {shift.breakEnd}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        ({getBreakDuration(shift.breakStart, shift.breakEnd)})
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground/70 text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={overtimeOn ? "info" : "secondary"}>
                    {overtimeOn ? "Açık" : "Kapalı"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={isActive ? "success" : "secondary"}>
                    {isActive ? "Aktif" : "Pasif"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(shift)}
                      className="hover:bg-accent/10 hover:border-accent"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(shift._id)}
                      className="hover:bg-destructive/10 hover:border-destructive text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
