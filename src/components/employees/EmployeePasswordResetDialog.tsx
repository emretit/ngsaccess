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
import { toast } from "@/hooks/use-toast";
import { Mail, Loader2 } from "lucide-react";

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
  const sendSetupEmail = useAction(api.actions.sendEmail.sendEmployeeSetupEmail);

  const firstName = employee?.firstName ?? "";
  const lastName = employee?.lastName ?? "";
  const email = employee?.email ?? "";

  const handleSendResetEmail = async () => {
    if (!employee) return;
    setIsLoading(true);
    try {
      await sendSetupEmail({
        employeeId: employee._id,
        email,
        firstName,
        lastName,
      });
      toast({
        title: "Mail Gönderildi",
        description: `${firstName} ${lastName} adlı personele şifre sıfırlama maili gönderildi.`,
      });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Mail gönderilirken hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Şifre Sıfırlama Maili
          </DialogTitle>
          <DialogDescription>
            {employee && (
              <>
                <strong>{firstName} {lastName}</strong> adlı personele şifre sıfırlama maili göndermek istediğinize emin misiniz?
                <br /><br />
                Mail adresi: <strong>{email}</strong>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            İptal
          </Button>
          <Button onClick={handleSendResetEmail} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Mail Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
