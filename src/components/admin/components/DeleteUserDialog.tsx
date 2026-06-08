import React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  onDelete,
}) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Kullanıcı Silme</AlertDialogTitle>
          <AlertDialogDescription>
            Bu işlem geri alınamaz. "{user?.email}" kullanıcısını ve tüm proje atamalarını
            silmek istediğinize emin misiniz?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button variant="destructive" onClick={onDelete}>Sil</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
