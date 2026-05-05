import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Plus, Users } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";

export default function Shifts() {
  const { loading: projectLoading } = useProjectAccess();
  const { toast } = useToast();
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    employeeId: "",
    shiftId: "",
    startDate: "",
    endDate: "",
  });
  const assignShift = useMutation(api.shifts.assignShift);
  const employees = useQuery(api.employees.list, !projectLoading ? {} : "skip");
  const shifts = useQuery(api.shifts.list, !projectLoading ? {} : "skip");
  const assignments = useQuery(api.shifts.listAssignments, !projectLoading ? {} : "skip");

  if (projectLoading) {
    return <LoadingSpinner text="Vardiya verileri yükleniyor..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vardiya Yönetimi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Çalışan vardiya atamaları ve takvim görünümü
          </p>
        </div>
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="mr-2 h-4 w-4" />
              Vardiya Ata
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Vardiya Ata</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label>Çalışan</Label>
                <Select
                  value={assignForm.employeeId}
                  onValueChange={(v) => setAssignForm((p) => ({ ...p, employeeId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Çalışan seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((e) => (
                      <SelectItem key={e._id} value={e._id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Vardiya</Label>
                <Select
                  value={assignForm.shiftId}
                  onValueChange={(v) => setAssignForm((p) => ({ ...p, shiftId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Vardiya seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {shifts?.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name} ({s.startTime}-{s.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Başlangıç Tarihi</Label>
                <Input
                  type="date"
                  value={assignForm.startDate}
                  onChange={(e) => setAssignForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={assignForm.endDate}
                  onChange={(e) => setAssignForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <Button
                onClick={async () => {
                  if (!assignForm.employeeId || !assignForm.shiftId || !assignForm.startDate || !assignForm.endDate) {
                    toast({ title: "Eksik bilgi", variant: "destructive" });
                    return;
                  }
                  try {
                    const emp = employees?.find((e) => e._id === assignForm.employeeId);
                    await assignShift({
                      employeeId: assignForm.employeeId as Id<"employees">,
                      shiftId: assignForm.shiftId as Id<"shifts">,
                      projectId: emp?.projectId,
                      startDate: assignForm.startDate,
                      endDate: assignForm.endDate,
                    });
                    toast({ title: "Vardiya atandı" });
                    setAssignForm({ employeeId: "", shiftId: "", startDate: "", endDate: "" });
                    setAssignOpen(false);
                  } catch {
                    toast({ title: "Hata", variant: "destructive" });
                  }
                }}
              >
                Ata
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tanımlı Vardiyalar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {shifts && shifts.length > 0 ? (
              <ul className="space-y-3">
                {shifts.map((s) => (
                  <li
                    key={s._id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.startTime} - {s.endTime}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Henüz vardiya tanımlanmamış. Ayarlar üzerinden vardiya ekleyebilirsiniz.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Vardiya Atamaları
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assignments && assignments.length > 0 ? (
              <ul className="space-y-3">
                {assignments.slice(0, 5).map((a) => (
                  <li
                    key={a._id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50 text-sm"
                  >
                    <span>Atama #{a._id.slice(-6)}</span>
                    <span className="text-muted-foreground">
                      {a.startDate} - {a.endDate}
                    </span>
                  </li>
                ))}
                {assignments.length > 5 && (
                  <li className="text-sm text-muted-foreground pt-2">
                    +{assignments.length - 5} atama daha
                  </li>
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Henüz vardiya ataması yok. "Vardiya Ata" butonu ile atama yapabilirsiniz.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Takvim Görünümü</CardTitle>
          <p className="text-sm text-muted-foreground">
            Haftalık/aylık vardiya takvimi ve sürükle-bırak atama özelliği yakında eklenecek.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 rounded-lg border-2 border-dashed border-muted-foreground/25">
            <Calendar className="h-16 w-16 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
