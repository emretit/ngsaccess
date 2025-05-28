
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
import { User } from '../types/user-types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Mail, Loader2 } from 'lucide-react';

interface UserPasswordResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function UserPasswordResetDialog({
  isOpen,
  onOpenChange,
  user
}: UserPasswordResetDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendResetEmail = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-user-setup-email', {
        body: {
          user_id: user.id,
          email: user.email,
          role: user.role
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      console.log('Email sent successfully:', data);

      toast({
        title: "Mail Gönderildi",
        description: `${user.email} adresine şifre sıfırlama maili gönderildi.`,
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error sending email:', error);
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
            {user && (
              <>
                <strong>{user.email}</strong> adresine şifre sıfırlama maili göndermek istediğinize emin misiniz?
                <br />
                <br />
                <strong>Rol:</strong> {user.role === 'super_admin' ? 'Süper Admin' : 
                                      user.role === 'project_admin' ? 'Proje Yöneticisi' : 'Kullanıcı'}
                <br />
                <br />
                Bu mail, kullanıcının mevcut şifresini sıfırlayacak ve yeni bir şifre belirlemesi için 24 saat geçerli bir bağlantı gönderecektir.
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
