
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { User, Project, UserFormData } from '../types/user-types';

interface UserFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  formData: UserFormData;
  projects: Project[];
  onFormDataChange: (data: UserFormData) => void;
  onSave: () => void;
  onProjectSelection: (projectId: number, checked: boolean) => void;
  onAdminRightsChange: (projectId: number, isAdmin: boolean) => void;
}

export const UserFormDialog: React.FC<UserFormDialogProps> = ({
  isOpen,
  onClose,
  currentUser,
  formData,
  projects,
  onFormDataChange,
  onSave,
  onProjectSelection,
  onAdminRightsChange
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{currentUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
          <DialogDescription>
            {currentUser ? 'Kullanıcı bilgilerini ve proje atamalarını güncelleyin' : 'Sisteme yeni bir kullanıcı ekleyin ve projeler atayın'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
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

          {formData.role !== 'super_admin' && (
            <div className="grid gap-4">
              <Label>Proje Atamaları*</Label>
              <div className="bg-muted/50 p-4 rounded-md space-y-4 max-h-[300px] overflow-y-auto border">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Henüz aktif proje bulunmamaktadır.</p>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={`project-${project.id}`}
                          checked={formData.selectedProjects.includes(project.id)}
                          onChange={(e) => onProjectSelection(project.id, e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                        <label htmlFor={`project-${project.id}`} className="text-sm font-medium">
                          #{project.id} - {project.name}
                        </label>
                      </div>
                      
                      {formData.selectedProjects.includes(project.id) && (
                        <div className="ml-7 flex items-center space-x-2">
                          <Switch
                            id={`admin-${project.id}`}
                            checked={formData.projectAdminRights[project.id] || false}
                            onCheckedChange={(checked) => onAdminRightsChange(project.id, checked)}
                          />
                          <Label htmlFor={`admin-${project.id}`} className="text-xs text-muted-foreground">
                            Bu projede admin yetkisine sahip olsun
                          </Label>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              {formData.role !== 'super_admin' && (
                <p className="text-xs text-muted-foreground">
                  * Süper admin olmayan kullanıcılar için en az bir proje seçimi zorunludur.
                </p>
              )}
            </div>
          )}
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
