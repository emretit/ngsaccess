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
import { Mail } from 'lucide-react';

interface UserPasswordResetDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

/**
 * Şifre sıfırlama akışı şu an devre dışı. Convex Auth (@convex-dev/auth) password
 * reset flow'u henüz entegre edilmedi — bu yapıldığında dialog yeniden aktif olacak.
 * (Kullanıcının mevcut şifresi authAccounts tablosunda Convex Auth tarafından
 * yönetiliyor; davet tabanlı reset ile değiştirilemiyor.)
 */
export function UserPasswordResetDialog({
  isOpen,
  onOpenChange,
  user,
}: UserPasswordResetDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Şifre Sıfırlama
          </DialogTitle>
          <DialogDescription>
            {user && (
              <>
                <strong>{user.email}</strong> için şifre sıfırlama özelliği şu an
                hazırlanıyor. Yakında bu sayfadan kullanıcılara şifre sıfırlama
                maili gönderebileceksiniz.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Kapat</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
