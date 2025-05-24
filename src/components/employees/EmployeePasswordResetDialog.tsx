
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Employee } from '@/types/employee';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Mail, Loader2 } from 'lucide-react';

interface EmployeePasswordResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function EmployeePasswordResetDialog({
  isOpen,
  onOpenChange,
  employee
}: EmployeePasswordResetDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSendResetEmail = async () => {
    if (!employee) return;

    setIsLoading(true);
    try {
      // Call Netlify function instead of Supabase function
      const response = await fetch('/.netlify/functions/send-employee-setup-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: employee.id,
          email: employee.email,
          first_name: employee.first_name,
          last_name: employee.last_name
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Mail gönderilirken bir hata oluştu.');
      }

      // Store the token in employee_auth table
      if (data.token) {
        const { error: authError } = await supabase
          .from('employee_auth')
          .upsert({
            employee_id: employee.id,
            email: employee.email,
            password_hash: null,
            setup_token: data.token,
            token_expires_at: data.expires_at,
            last_login: null
          });

        if (authError) {
          console.error('Error storing auth token:', authError);
          // Continue anyway since email was sent
        }
      }

      toast({
        title: "Mail Gönderildi",
        description: `${employee.first_name} ${employee.last_name} adlı personele şifre sıfırlama maili gönderildi.`,
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Hata",
        description: error.message || "Mail gönderilirken bir hata oluştu.",
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
                <strong>{employee.first_name} {employee.last_name}</strong> adlı personele şifre sıfırlama maili göndermek istediğinize emin misiniz?
                <br />
                <br />
                Mail adresi: <strong>{employee.email}</strong>
                <br />
                <br />
                Bu mail, personelin mevcut şifresini sıfırlayacak ve yeni bir şifre belirlemesi için 24 saat geçerli bir bağlantı gönderecektir.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            İptal
          </Button>
          <Button 
            onClick={handleSendResetEmail}
            disabled={isLoading}
          >
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
