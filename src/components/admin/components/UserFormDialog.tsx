import { roleLabel } from "@/lib/roleLabels";
import { Checkbox } from "@/components/ui/checkbox";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
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
import type { Id } from '../../../../convex/_generated/dataModel';
import { User, UserFormData, Project } from '../types/user-types';

interface UserFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  formData: UserFormData;
  onFormDataChange: (data: UserFormData) => void;
  onSave: () => void;
  isSaving?: boolean;
  projects: Project[];
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  isOpen,
  onClose,
  currentUser,
  formData,
  onFormDataChange,
  onSave,
  isSaving = false,
  projects
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isSaving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{currentUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
          <DialogDescription>
            {currentUser ? 'Rol tüm projelerde geçerlidir. İşaretli proje üyelikleri kaydedilecektir.' : 'Sisteme yeni bir kullanıcı ekleyin. Kullanıcıya şifre belirleme emaili gönderilecektir.'}
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
              disabled={!!currentUser || isSaving}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="role">Rol</Label>
            <Select 
              disabled={isSaving}
              value={formData.role} 
              onValueChange={(value: 'super_admin' | 'project_admin' | 'project_user') => 
                onFormDataChange({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Rol seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {currentUser && (
                    <SelectItem value="super_admin">{roleLabel("super_admin")}</SelectItem>
                  )}
                  <SelectItem value="project_admin">{roleLabel("project_admin")}</SelectItem>
                  <SelectItem value="project_user">{roleLabel("project_user")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {currentUser ? (
            <div className="space-y-2">
              <Label>Proje üyelikleri</Label>
              {projects.map(project => (
                <label key={project._id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    disabled={isSaving}
                    checked={formData.projectIds?.includes(project._id) ?? false}
                    onCheckedChange={checked => onFormDataChange({
                      ...formData,
                      projectIds: checked
                        ? [...(formData.projectIds ?? []), project._id]
                        : (formData.projectIds ?? []).filter(id => id !== project._id),
                    })}
                  />
                  {project.name}
                </label>
              ))}
              <p className="text-xs text-muted-foreground">İşareti kaldırılan projeye erişim kaldırılır. Süper admin bütün projelere erişir.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="project">Proje*</Label>
              <Select
                disabled={isSaving}
                value={formData.projectId != null ? String(formData.projectId) : ""} 
                onValueChange={(value) => 
                  onFormDataChange({ ...formData, projectId: value ? (value as Id<"projects">) : undefined })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Proje seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {projects.map(project => <SelectItem key={project._id} value={project._id}>{project.name}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            İptal
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Kaydediliyor</>
            ) : (
              currentUser ? 'Güncelle' : 'Oluştur'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
