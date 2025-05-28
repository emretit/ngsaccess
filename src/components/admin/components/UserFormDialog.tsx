
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { User, UserFormData } from '../types/user-types';

interface UserFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  formData: UserFormData;
  onFormDataChange: (data: UserFormData) => void;
  onSave: () => void;
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  isOpen,
  onClose,
  currentUser,
  formData,
  onFormDataChange,
  onSave
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{currentUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
          <DialogDescription>
            {currentUser ? 'Kullanıcı bilgilerini güncelleyin' : 'Sisteme yeni bir kullanıcı ekleyin'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-posta*</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => onFormDataChange({ ...formData, email: e.target.value })}
              disabled={!!currentUser}
            />
          </div>
          
          {!currentUser && (
            <div className="grid gap-2">
              <Label htmlFor="password">Şifre*</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => onFormDataChange({ ...formData, password: e.target.value })}
              />
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="role">Rol</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value: 'super_admin' | 'project_admin' | 'project_user') => 
                onFormDataChange({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Rol seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="super_admin">Süper Admin</SelectItem>
                  <SelectItem value="project_admin">Proje Yöneticisi</SelectItem>
                  <SelectItem value="project_user">Kullanıcı</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button onClick={onSave}>
            {currentUser ? 'Güncelle' : 'Oluştur'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
