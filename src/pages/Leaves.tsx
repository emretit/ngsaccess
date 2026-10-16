import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";
import { Label } from "@/components/ui/label";
import { Palmtree, Plus, Check, X, Calendar } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { toast as notify } from "sonner";

const LEAVE_TYPES = [
  { value: "annual", label: "Yıllık İzin" },
  { value: "sick", label: "Hastalık İzni" },
  { value: "excuse", label: "Mazeret İzni" },
  { value: "unpaid", label: "Ücretsiz İzin" },
  { value: "parental", label: "Doğum/Ebeveyn İzni" },
  { value: "marriage", label: "Evlilik İzni (3 gün)" },
  { value: "bereavement", label: "Vefat İzni (3 gün)" },
  { value: "paternity", label: "Babalık İzni (5 gün)" },
  { value: "lactation", label: "Süt İzni" },
  { value: "compensatory", label: "Telafi İzni" },
] as const;

type LeaveTypeValue = (typeof LEAVE_TYPES)[number]["value"];

export default function Leaves() {
  const { loading: projectLoading } = useProjectAccess();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "super_admin" || profile?.role === "project_admin";
  const createLeave = useMutation(api.leaves.create);
  const approveLeave = useMutation(api.leaves.approve);
  const rejectLeave = useMutation(api.leaves.reject);
  const leaves: FunctionReturnType<typeof api.leaves.list> | undefined = useQuery(
    api.leaves.list,
    !projectLoading ? {} : "skip"
  );
  const employees = useQuery(api.employees.list, !projectLoading ? {} : "skip");
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decidingLeaveId, setDecidingLeaveId] = useState<Id<"leaves"> | null>(null);
  const [formData, setFormData] = useState({
    employeeId: "" as "" | (string & {}),
    leaveType: "annual",
    startDate: "",
    endDate: "",
    notes: "",
  });

  if (projectLoading || leaves === undefined || employees === undefined) {
    return <LoadingSpinner text="İzin verileri yükleniyor..." />;
  }

  const pendingLeaves = leaves?.filter((l) => l.status === "pending") ?? [];

  const employeeById = new Map(employees.map((employee) => [employee._id, employee]));

  const renderLeaveDetails = (leave: FunctionReturnType<typeof api.leaves.list>[number]) => {
    const employee = employeeById.get(leave.employeeId);
    const start = parseDateString(leave.startDate);
    const end = parseDateString(leave.endDate);
    const days = start && end
      ? Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1
      : undefined;
    return (
      <div className="min-w-0">
        <span className="font-medium block">
          {employee ? `${employee.firstName} ${employee.lastName}` : "Personel bulunamadı"}
        </span>
        <span className="text-sm text-muted-foreground block">{employee?.departments?.name ?? "Departman belirtilmemiş"}</span>
        <span className="text-sm block">{getLeaveTypeLabel(leave.leaveType)}</span>
        <span className="text-sm text-muted-foreground block">
          {start?.toLocaleDateString("tr-TR") ?? leave.startDate} - {end?.toLocaleDateString("tr-TR") ?? leave.endDate}
          {days !== undefined && days > 0 ? ` · ${days} gün` : " · Süre hesaplanamadı"}
        </span>
        {leave.notes && <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{leave.notes}</p>}
      </div>
    );
  };

  const decideLeave = async (leaveId: Id<"leaves">, decision: "approved" | "rejected") => {
    if (!isAdmin || decidingLeaveId) return;
    setDecidingLeaveId(leaveId);
    try {
      if (decision === "approved") await approveLeave({ leaveId });
      else await rejectLeave({ leaveId });
      notify.success(decision === "approved" ? "İzin onaylandı" : "İzin reddedildi");
    } catch (error) {
      notify.error("İşlem tamamlanamadı", { description: error instanceof Error ? error.message : "Lütfen tekrar deneyin." });
    } finally {
      setDecidingLeaveId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800">Beklemede</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-800">Onaylandı</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-800">Reddedildi</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getLeaveTypeLabel = (type: string) =>
    LEAVE_TYPES.find((t) => t.value === type)?.label ?? type;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Palmtree className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">İzin Yönetimi</h2>
              <p className="text-xs text-muted-foreground">
                {pendingLeaves.length} bekleyen, {leaves?.length ?? 0} toplam
              </p>
            </div>
          </div>
          {isAdmin && <div className="ml-auto">
            <Button
              onClick={() => setShowForm(!showForm)}
              size="sm"
              className="h-8 gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              İzin Ekle
            </Button>
          </div>}
        </div>
      </div>

      {isAdmin && showForm && (
        <Card>
          <CardHeader>
            <CardTitle>İzin Ekle</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Çalışan</Label>
                <Select
                  value={formData.employeeId}
                  onValueChange={(v) => setFormData((p) => ({ ...p, employeeId: v }))}
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
                <Label>İzin Türü</Label>
                <Select
                  value={formData.leaveType}
                  onValueChange={(v) => setFormData((p) => ({ ...p, leaveType: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Başlangıç Tarihi</Label>
                <DatePicker
                  date={parseDateString(formData.startDate)}
                  onSelect={(d) =>
                    setFormData((p) => ({ ...p, startDate: formatDateString(d) }))
                  }
                />
              </div>
              <div>
                <Label>Bitiş Tarihi</Label>
                <DatePicker
                  date={parseDateString(formData.endDate)}
                  onSelect={(d) =>
                    setFormData((p) => ({ ...p, endDate: formatDateString(d) }))
                  }
                  minDate={parseDateString(formData.startDate)}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Not (Opsiyonel)</Label>
                <Input
                  placeholder="İzin notu..."
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <Button
              disabled={isSubmitting}
              onClick={async () => {
                if (!isAdmin || isSubmitting) return;
                if (!formData.employeeId || !formData.startDate || !formData.endDate) {
                  toast({
                    title: "Eksik bilgi",
                    description: "Çalışan, başlangıç ve bitiş tarihi zorunludur.",
                    variant: "destructive",
                  });
                  return;
                }
                setIsSubmitting(true);
                try {
                  const emp = employees?.find((e) => e._id === formData.employeeId);
                  await createLeave({
                    employeeId: formData.employeeId as Id<"employees">,
                    projectId: emp?.projectId,
                    leaveType: formData.leaveType as LeaveTypeValue,
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    notes: formData.notes || undefined,
                  });
                  toast({ title: "İzin kaydedildi" });
                  setFormData({ employeeId: "", leaveType: "annual", startDate: "", endDate: "", notes: "" });
                  setShowForm(false);
                } catch {
                  toast({
                    title: "Hata",
                    description: "İzin kaydedilemedi.",
                    variant: "destructive",
                  });
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? "Kaydediliyor..." : "İzin Ekle"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className={`grid grid-cols-1 gap-6 ${pendingLeaves.length > 0 ? "lg:grid-cols-2" : ""}`}>
        {pendingLeaves.length > 0 && <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Bekleyen İzinler ({pendingLeaves.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {pendingLeaves.map((leave) => (
                <li key={leave._id} className="flex justify-between items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {renderLeaveDetails(leave)}
                  {isAdmin && <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="text-green-600" disabled={decidingLeaveId !== null}
                      aria-label={`${employeeById.get(leave.employeeId)?.firstName ?? "Personel"} iznini onayla`}
                      onClick={() => decideLeave(leave._id, "approved")}>
                      <Check className="h-4 w-4" />
                      Onayla
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" disabled={decidingLeaveId !== null}
                      aria-label={`${employeeById.get(leave.employeeId)?.firstName ?? "Personel"} iznini reddet`}
                      onClick={() => decideLeave(leave._id, "rejected")}>
                      <X className="h-4 w-4" />
                      Reddet
                    </Button>
                  </div>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palmtree className="h-5 w-5" />
              Tüm İzinler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaves && leaves.length > 0 ? (
              <ul className="space-y-3 max-h-64 overflow-y-auto">
                {leaves.map((l) => (
                  <li
                    key={l._id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50 text-sm"
                  >
                    {renderLeaveDetails(l)}
                    {getStatusBadge(l.status)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Henüz izin kaydı yok.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
