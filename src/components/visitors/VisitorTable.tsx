"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Visitor, visitorStatusInfo } from "@/types/visitor";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { EmptyState } from "@/components/shared/EmptyState";
import { Edit2, Trash2, LogOut, Undo2 } from "lucide-react";
import { notify } from "@/lib/notify";
import { formatVisitorTime } from "./visitorTime";

interface VisitorTableProps {
  visitors: Visitor[];
  onEdit: (visitor: Visitor) => void;
  onRefresh?: () => void;
}

export default function VisitorTable({ visitors, onEdit, onRefresh }: VisitorTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<Visitor | null>(null);

  const removeEmployee = useMutation(api.employees.remove);
  const checkOut = useMutation(api.visitors.checkOut);
  const releaseCard = useMutation(api.visitors.releaseCard);

  const release = useAsyncAction(async (visitor: Visitor) => {
    await releaseCard({ visitorId: visitor._id });
    onRefresh?.();
  }, { success: "Kart serbest; başka ziyaretçiye verilebilir", error: "Kart serbest bırakılamadı" });


  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[820px]">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="font-semibold text-foreground">Ad Soyad</TableHead>
            <TableHead className="font-semibold text-foreground">Şirket</TableHead>
            <TableHead className="font-semibold text-foreground">Ziyaret Edilen</TableHead>
            <TableHead className="font-semibold text-foreground">Bölge</TableHead>
            <TableHead className="font-semibold text-foreground">Kart No</TableHead>
            <TableHead className="font-semibold text-foreground">Geçerlilik Bitişi</TableHead>
            <TableHead className="font-semibold text-foreground">Durum</TableHead>
            <TableHead className="text-right font-semibold text-foreground">İşlemler</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visitors.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="h-32 text-center text-muted-foreground text-sm">
                <EmptyState title="Ziyaretçi bulunamadı" description="Seçili filtrelere uygun kayıt yok." />
              </TableCell>
            </TableRow>
          ) : (
            visitors.map((visitor) => {
              const status = visitorStatusInfo(visitor);
              return (
                <TableRow
                  key={visitor._id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("button, a")) return;
                    onEdit(visitor);
                  }}
                >
                  <TableCell className="font-medium">
                    {visitor.firstName} {visitor.lastName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {visitor.visitorCompany || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {visitor.host ? `${visitor.host.firstName} ${visitor.host.lastName}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {visitor.presetRule?.name || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {visitor.cardNumber?.startsWith("IADE:") ? (
                      <span className="text-muted-foreground italic">İade edildi</span>
                    ) : (
                      visitor.cardNumber || "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatVisitorTime(visitor.accessExpiresAt)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={status.variant === "success" ? "success" : status.variant === "destructive" ? "danger" : status.variant === "default" ? "info" : "neutral"}>
                      {status.label}
                    </StatusBadge>
                    <a href="#visitor-sync-status" className="block text-xs underline mt-1">Proje cihaz durumu</a>
                    <div className="text-xs text-muted-foreground mt-1">{visitor.presence === "inside" ? "Son başarılı okuma: içeride" : visitor.presence === "outside" ? "Son başarılı okuma: dışarıda" : "Konum bilinmiyor"}</div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {visitor.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setCheckoutTarget(visitor)}
                          disabled={release.pending}
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                          title="Ziyareti sonlandır" aria-label={`${visitor.firstName} ${visitor.lastName} ziyaretini sonlandır`}
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                      {!visitor.isActive && !visitor.cardNumber?.startsWith("IADE:") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => release.run(visitor)}
                          disabled={release.pending}
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                          title="Kartı Serbest Bırak (rozet iadesi)" aria-label={`${visitor.firstName} ${visitor.lastName} kartını serbest bırak`}
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(visitor)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Düzenle" aria-label={`${visitor.firstName} ${visitor.lastName} ziyaretçisini düzenle`}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(visitor)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Sil" aria-label={`${visitor.firstName} ${visitor.lastName} ziyaretçisini sil`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <ConfirmDestructive
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Ziyaretçi silinsin mi?"
        objectName={deleteTarget ? `${deleteTarget.firstName} ${deleteTarget.lastName}` : ""}
        effects={["Ziyaretçi kaydı ve bölge üyelikleri kalıcı olarak silinir.", "Cihazlardan kaldırma işlemi başlatılır; bağlı kişisel veriler temizlenir."]}
        confirmLabel="Ziyaretçiyi sil"
        onConfirm={async () => {
          if (!deleteTarget) return;
          await removeEmployee({ employeeId: deleteTarget._id });
          notify.success("Ziyaretçi silindi");
          onRefresh?.();
        }}
      />
      <ConfirmDestructive
        open={checkoutTarget !== null}
        onOpenChange={(open) => { if (!open) setCheckoutTarget(null); }}
        title="Ziyaret sonlandırılsın mı?"
        objectName={checkoutTarget ? `${checkoutTarget.firstName} ${checkoutTarget.lastName}` : ""}
        effects={["Erişim pasife alınır ve cihazlardan kaldırma işlemi başlatılır.", "Bu işlem fiziksel çıkış okuması oluşturmaz; kart iadesi ayrıca yapılır."]}
        confirmLabel="Ziyareti sonlandır"
        onConfirm={async () => {
          if (!checkoutTarget) return;
          await checkOut({ visitorId: checkoutTarget._id });
          notify.success("Ziyaret sonlandırıldı", "Cihaz işlemleri senkronizasyon şeridinden izlenebilir.");
          onRefresh?.();
        }}
      />
    </div>
  );
}
