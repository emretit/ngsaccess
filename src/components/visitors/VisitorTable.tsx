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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Trash2, LogOut, Undo2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatVisitorTime } from "./visitorTime";

interface VisitorTableProps {
  visitors: Visitor[];
  onEdit: (visitor: Visitor) => void;
  onRefresh?: () => void;
}

export default function VisitorTable({ visitors, onEdit, onRefresh }: VisitorTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<Visitor | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);

  const removeEmployee = useMutation(api.employees.remove);
  const checkOut = useMutation(api.visitors.checkOut);
  const releaseCard = useMutation(api.visitors.releaseCard);

  const handleReleaseCard = async (visitor: Visitor) => {
    try {
      await releaseCard({ visitorId: visitor._id });
      toast({ title: "Kart serbest", description: "Kart başka ziyaretçiye verilebilir" });
      onRefresh?.();
    } catch (err) {
      toast({
        title: "Hata",
        description: (err as Error).message || "Kart serbest bırakılamadı",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await removeEmployee({ employeeId: deleteTarget._id });
      toast({ title: "Başarılı", description: "Ziyaretçi silindi" });
      setDeleteTarget(null);
      onRefresh?.();
    } catch (err) {
      toast({
        title: "Hata",
        description: (err as Error).message || "Ziyaretçi silinemedi",
        variant: "destructive",
      });
    }
  };

  const handleCheckOut = async (visitor: Visitor) => {
    setCheckingOutId(visitor._id);
    try {
      await checkOut({ visitorId: visitor._id });
      toast({ title: "Çıkış", description: `${visitor.firstName} ${visitor.lastName} çıkış yaptı` });
      onRefresh?.();
    } catch (err) {
      toast({
        title: "Hata",
        description: (err as Error).message || "Çıkış işlemi başarısız",
        variant: "destructive",
      });
    } finally {
      setCheckingOutId(null);
    }
  };

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
                Ziyaretçi bulunamadı.
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
                    if ((e.target as HTMLElement).closest("button")) return;
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
                    <Badge variant={status.variant} className="text-xs">
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      {visitor.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCheckOut(visitor)}
                          disabled={checkingOutId === visitor._id}
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                          title="Çıkış Yaptır"
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      )}
                      {!visitor.isActive && !visitor.cardNumber?.startsWith("IADE:") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReleaseCard(visitor)}
                          className="h-8 w-8 text-muted-foreground hover:text-amber-600"
                          title="Kartı Serbest Bırak (rozet iadesi)"
                        >
                          <Undo2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(visitor)}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title="Düzenle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(visitor)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Sil"
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ziyaretçiyi silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. Ziyaretçi kalıcı olarak silinecek ve cihazlardan kaldırılacaktır.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
