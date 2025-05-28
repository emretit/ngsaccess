
import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { User } from '../types/user-types';

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onDelete: () => void;
}

export const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({
  isOpen,
  onClose,
  user,
  onDelete
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kullanıcı Silme</DialogTitle>
          <DialogDescription>
            Bu işlem geri alınamaz. "{user?.email}" kullanıcısını ve tüm proje atamalarını silmek istediğinize emin misiniz?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            Sil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
