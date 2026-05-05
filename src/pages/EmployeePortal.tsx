import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Palmtree, User, QrCode } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { QRCodeSVG as QRCode } from "qrcode.react";

const LEAVE_LABELS: Record<string, string> = {
  annual: "Yıllık",
  sick: "Hastalık",
  excuse: "Mazeret",
  unpaid: "Ücretsiz",
  parental: "Doğum/Ebeveyn",
};

export default function EmployeePortal() {
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const { loading } = useProjectAccess();

  const employees = useQuery(api.employees.list, !loading ? {} : "skip");
  const tableData = useQuery(
    api.cardReadings.getPdksTableData,
    employeeId && !loading
      ? { date: new Date().toISOString().split("T")[0] }
      : "skip"
  );
  const leaves = useQuery(
    api.leaves.list,
    employeeId ? { employeeId: employeeId as import("../../convex/_generated/dataModel").Id<"employees"> } : "skip"
  );
  const createToken = useMutation(api.employeeCheckIn.createCheckInToken);
  const [checkInToken, setCheckInToken] = useState<string | null>(null);
  const [checkInExpires, setCheckInExpires] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    createToken({ employeeId: employeeId as import("../../convex/_generated/dataModel").Id<"employees"> })
      .then((r) => {
        if (!cancelled) {
          setCheckInToken(r.token);
          setCheckInExpires(r.expiresAt);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [employeeId, createToken]);

  const checkInUrl = checkInToken
    ? `${window.location.origin}/check-in?token=${checkInToken}`
    : "";

  if (!employees) {
    return <LoadingSpinner text="Yükleniyor..." />;
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Çalışan Portalı</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          PDKS kayıtlarınız, izin talepleriniz ve vardiya bilgileriniz
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Çalışan Seçin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full max-w-md p-2 border rounded-md"
            value={employeeId ?? ""}
            onChange={(e) => setEmployeeId(e.target.value || null)}
          >
            <option value="">Çalışan seçin...</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {employeeId && (
        <Tabs defaultValue="pdks" className="w-full">
          <TabsList>
            <TabsTrigger value="pdks">
              <Clock className="h-4 w-4 mr-2" />
              PDKS Kayıtları
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="h-4 w-4 mr-2" />
              QR Check-In
            </TabsTrigger>
            <TabsTrigger value="leaves">
              <Palmtree className="h-4 w-4 mr-2" />
              İzinlerim
            </TabsTrigger>
          </TabsList>
          <TabsContent value="pdks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Bugünkü Kayıtlar</CardTitle>
              </CardHeader>
              <CardContent>
                {tableData && tableData.length > 0 ? (
                  <div className="space-y-2">
                    {tableData
                      .filter((r) => r.employeeId === employeeId || r.id === employeeId)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="flex justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <span>İlk Giriş: {r.firstEntry}</span>
                          <span>Son Çıkış: {r.lastExit}</span>
                          <span>Toplam: {r.totalHours}</span>
                          <span>Mesai: {r.overtime}</span>
                        </div>
                      ))}
                    {tableData.filter((r) => r.employeeId === employeeId || r.id === employeeId).length === 0 && (
                      <p className="text-muted-foreground">Bugün kayıt yok</p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Bugün kayıt yok</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="qr" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>QR Check-In</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Bu QR kodunu okuyarak giriş yapabilirsiniz. Kod 5 dakika geçerlidir.
                </p>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {checkInUrl ? (
                  <>
                    <div className="p-4 bg-white rounded-lg">
                      <QRCode value={checkInUrl} size={200} level="M" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Geçerlilik: {checkInExpires ? new Date(checkInExpires).toLocaleTimeString("tr-TR") : "-"}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">Yükleniyor...</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="leaves" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>İzin Taleplerim</CardTitle>
              </CardHeader>
              <CardContent>
                {leaves && leaves.length > 0 ? (
                  <ul className="space-y-3">
                    {leaves.map((l) => (
                      <li
                        key={l._id}
                        className="flex justify-between items-center p-3 rounded-lg bg-muted/50"
                      >
                        <span>{LEAVE_LABELS[l.leaveType] ?? l.leaveType}</span>
                        <span className="text-sm text-muted-foreground">
                          {l.startDate} - {l.endDate}
                        </span>
                        <span
                          className={`text-sm font-medium ${
                            l.status === "approved"
                              ? "text-green-600"
                              : l.status === "rejected"
                                ? "text-red-600"
                                : "text-yellow-600"
                          }`}
                        >
                          {l.status === "approved" ? "Onaylandı" : l.status === "rejected" ? "Reddedildi" : "Beklemede"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">Henüz izin talebi yok</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
