import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { Smartphone, Loader2 } from "lucide-react";

interface Employee {
  _id: Id<"employees">;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface EmployeePasswordResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function EmployeePasswordResetDialog({
  isOpen,
  onOpenChange,
  employee,
}: EmployeePasswordResetDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const sendSetupEmail = useAction(
    api.actions.sendEmail.sendEmployeeSetupEmail,
  );

  const firstName = employee?.firstName ?? "";
  const lastName = employee?.lastName ?? "";
  const email = employee?.email ?? "";

  const { run: handleSendResetEmail, pending } = useAsyncAction(async () => {
    if (!employee) return;
    setIsLoading(true);
    try {
      const result = await sendSetupEmail({
        employeeId: employee._id,
      });
      if (!result.success) {
        throw new Error(result.error ?? "Mail gönderilemedi");
      }
      notify.success(
        "Mobil giriş bağlantısı gönderildi",
        `${firstName} ${lastName}`,
      );
      onOpenChange(false);
    } catch (error: unknown) {
      notify.error("Mobil giriş bağlantısı gönderilemedi", error);
    } finally {
      setIsLoading(false);
    }
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!isLoading && !pending) onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobil giriş bağlantısı gönder
          </DialogTitle>
          <DialogDescription>
            {employee && (
              <>
                <strong>
                  {firstName} {lastName}
                </strong>{" "}
                adlı personele <strong>mobil uygulama</strong> için şifre
                kurulum bağlantısı göndermek istediğinize emin misiniz?
                <br />
                <br />
                Bu şifre yönetim panelinden (web) tamamen bağımsızdır; çalışan
                yalnızca mobil uygulamada kullanır.
                <br />
                <br />
                Mail adresi: <strong>{email}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading || pending}
          >
            İptal
          </Button>
          <Button
            onClick={handleSendResetEmail}
            disabled={isLoading || pending}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Smartphone className="mr-2 h-4 w-4" />
                Bağlantıyı gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
