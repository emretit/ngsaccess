import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
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
import { Label } from "@/components/ui/label";
import { Palmtree, Plus, Check, X, Calendar } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";

const LEAVE_TYPES = [
  { value: "annual", label: "Yıllık İzin" },
  { value: "sick", label: "Hastalık İzni" },
  { value: "excuse", label: "Mazeret İzni" },
  { value: "unpaid", label: "Ücretsiz İzin" },
  { value: "parental", label: "Doğum/Ebeveyn İzni" },
];

export default function Leaves() {
  const { loading: projectLoading } = useProjectAccess();
  const { profile } = useAuth();
  const createLeave = useMutation(api.leaves.create);
  const approveLeave = useMutation(api.leaves.approve);
  const rejectLeave = useMutation(api.leaves.reject);
  const leaves = useQuery(
    api.leaves.list,
    !projectLoading ? {} : "skip"
  );
  const employees = useQuery(api.employees.list, !projectLoading ? {} : "skip");
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: "" as "" | (string & {}),
    leaveType: "annual",
    startDate: "",
    endDate: "",
    notes: "",
  });

  if (projectLoading) {
    return <LoadingSpinner text="İzin verileri yükleniyor..." />;
  }

  const pendingLeaves = leaves?.filter((l) => l.status === "pending") ?? [];

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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">İzin Yönetimi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            İzin talepleri ve onay işlemleri
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" />
          İzin Talebi
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Yeni İzin Talebi</CardTitle>
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
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label>Bitiş Tarihi</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Not (Opsiyonel)</Label>
                <Input
                  placeholder="İzin talebi notu..."
                  value={formData.notes}
                  onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <Button
              onClick={async () => {
                if (!formData.employeeId || !formData.startDate || !formData.endDate) {
                  toast({
                    title: "Eksik bilgi",
                    description: "Çalışan, başlangıç ve bitiş tarihi zorunludur.",
                    variant: "destructive",
                  });
                  return;
                }
                try {
                  const emp = employees?.find((e) => e._id === formData.employeeId);
                  await createLeave({
                    employeeId: formData.employeeId as Id<"employees">,
                    projectId: emp?.projectId,
                    leaveType: formData.leaveType as "annual" | "sick" | "excuse" | "unpaid" | "parental",
                    startDate: formData.startDate,
                    endDate: formData.endDate,
                    notes: formData.notes || undefined,
                  });
                  toast({ title: "İzin talebi gönderildi", description: "Talep onay bekliyor." });
                  setFormData({ employeeId: "", leaveType: "annual", startDate: "", endDate: "", notes: "" });
                  setShowForm(false);
                } catch {
                  toast({
                    title: "Hata",
                    description: "İzin talebi oluşturulamadı.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Talebi Gönder
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Bekleyen Talepler ({pendingLeaves.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingLeaves.length > 0 ? (
              <ul className="space-y-3">
                {pendingLeaves.map((l) => (
                  <li
                    key={l._id}
                    className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                  >
                    <div>
                      <span className="font-medium">{getLeaveTypeLabel(l.leaveType)}</span>
                      <span className="text-sm text-muted-foreground block">
                        {l.startDate} - {l.endDate}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600"
                        onClick={async () => {
                          const userId = (profile as { _id?: Id<"users"> })?._id;
                          if (!userId) {
                            toast({ title: "Yetki gerekli", description: "Onay için giriş yapmalısınız.", variant: "destructive" });
                            return;
                          }
                          try {
                            await approveLeave({ leaveId: l._id, approvedBy: userId });
                            toast({ title: "İzin onaylandı" });
                          } catch {
                            toast({ title: "Hata", variant: "destructive" });
                          }
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={async () => {
                          const userId = (profile as { _id?: Id<"users"> })?._id;
                          if (!userId) {
                            toast({ title: "Yetki gerekli", description: "Red için giriş yapmalısınız.", variant: "destructive" });
                            return;
                          }
                          try {
                            await rejectLeave({ leaveId: l._id, approvedBy: userId });
                            toast({ title: "İzin reddedildi" });
                          } catch {
                            toast({ title: "Hata", variant: "destructive" });
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">Bekleyen izin talebi yok.</p>
            )}
          </CardContent>
        </Card>

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
                    <div>
                      <span className="font-medium">{getLeaveTypeLabel(l.leaveType)}</span>
                      <span className="text-muted-foreground block">
                        {l.startDate} - {l.endDate}
                      </span>
                    </div>
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
