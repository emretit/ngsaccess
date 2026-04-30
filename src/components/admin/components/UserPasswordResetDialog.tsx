
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
import { useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
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
  const sendUserSetupEmail = useAction(api.actions.sendEmail.sendUserSetupEmail);

  const handleSendResetEmail = async () => {
    if (!user || !user.email) return;
    setIsLoading(true);
    try {
      await sendUserSetupEmail({
        userId: user._id,
        email: user.email,
        fullName: user.email,
      });
      toast({
        title: "Mail Gönderildi",
        description: `${user.email} adresine şifre sıfırlama maili gönderildi.`,
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
