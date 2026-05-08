import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { AssignmentEditDialog } from "./AssignmentEditDialog";
import { useToast } from "@/hooks/use-toast";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];
type Assignment = FunctionReturnType<typeof api.shifts.listAssignments>[number];

interface AssignmentsTableProps {
  employees: Employee[];
  shifts: Shift[];
  assignments: Assignment[];
}

type StatusFilter = "all" | "active" | "upcoming" | "past";

const PAGE_SIZE = 25;

function getStatus(a: Assignment, todayIso: string): StatusFilter {
  if (a.endDate < todayIso) return "past";
  if (a.startDate > todayIso) return "upcoming";
  return "active";
}

function statusBadge(status: StatusFilter) {
  if (status === "active") {
    return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200">Aktif</Badge>;
  }
  if (status === "upcoming") {
    return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-200">Yaklaşan</Badge>;
  }
  return <Badge variant="secondary">Geçmiş</Badge>;
}

function diffDays(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
}

export function AssignmentsTable({
  employees,
  shifts,
  assignments,
}: AssignmentsTableProps) {
  const { toast } = useToast();
  const removeAssignment = useMutation(api.shifts.removeAssignment);
  const [search, setSearch] = useState("");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter | "all">("all");
  const [page, setPage] = useState(0);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    for (const e of employees) m.set(e._id, e);
    return m;
  }, [employees]);

  const shiftMap = useMemo(() => {
    const m = new Map<string, Shift>();
    for (const s of shifts) m.set(s._id, s);
    return m;
  }, [shifts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments
      .filter((a) => {
        if (shiftFilter !== "all" && a.shiftId !== shiftFilter) return false;
        if (statusFilter !== "all" && getStatus(a, todayIso) !== statusFilter)
          return false;
        if (q) {
          const emp = employeeMap.get(a.employeeId);
          const name = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : "";
          if (!name.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.endDate.localeCompare(a.endDate));
  }, [assignments, search, shiftFilter, statusFilter, todayIso, employeeMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = async (id: Assignment["_id"]) => {
    try {
      await removeAssignment({ assignmentId: id });
      toast({ title: "Atama silindi" });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Silinemedi",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          placeholder="Çalışan ara..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="h-9 sm:max-w-xs"
        />
        <Select
          value={shiftFilter}
          onValueChange={(v) => {
            setShiftFilter(v);
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 sm:w-44">
            <SelectValue placeholder="Vardiya" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Vardiyalar</SelectItem>
            {shifts.map((s) => (
              <SelectItem key={s._id} value={s._id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as StatusFilter | "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="h-9 sm:w-40">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="upcoming">Yaklaşan</SelectItem>
            <SelectItem value="past">Geçmiş</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} kayıt
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Çalışan</TableHead>
              <TableHead>Vardiya</TableHead>
              <TableHead>Başlangıç</TableHead>
              <TableHead>Bitiş</TableHead>
              <TableHead className="text-right">Süre</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-24 text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Kriterlere uyan atama yok.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((a) => {
                const emp = employeeMap.get(a.employeeId);
                const shift = shiftMap.get(a.shiftId);
                const status = getStatus(a, todayIso);
                return (
                  <TableRow key={a._id}>
                    <TableCell className="font-medium">
                      {emp ? `${emp.firstName} ${emp.lastName}` : "—"}
                    </TableCell>
                    <TableCell>
                      {shift ? (
                        <span>
                          {shift.name}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({shift.startTime}–{shift.endTime})
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Silinmiş</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.startDate}</TableCell>
                    <TableCell className="text-sm">{a.endDate}</TableCell>
                    <TableCell className="text-right text-sm">
                      {diffDays(a.startDate, a.endDate)} gün
                    </TableCell>
                    <TableCell>{statusBadge(status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditAssignment(a)}
                          aria-label="Düzenle"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(a._id)}
                          aria-label="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Önceki
          </Button>
          <span className="text-muted-foreground">
            Sayfa {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1}
          >
            Sonraki
          </Button>
        </div>
      )}

      <AssignmentEditDialog
        open={editAssignment !== null}
        onOpenChange={(o) => !o && setEditAssignment(null)}
        assignment={editAssignment}
        shifts={shifts}
        shiftName={
          editAssignment ? shiftMap.get(editAssignment.shiftId)?.name ?? "" : ""
        }
        employeeName={
          editAssignment
            ? (() => {
                const e = employeeMap.get(editAssignment.employeeId);
                return e ? `${e.firstName} ${e.lastName}` : "";
              })()
            : ""
        }
      />
    </div>
  );
}
