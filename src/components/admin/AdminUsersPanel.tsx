import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
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
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  projects?: { id: number; name: string; is_admin: boolean }[];
}

interface Project {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

const AdminUsersPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'project_user' as 'super_admin' | 'project_admin' | 'project_user',
    selectedProjects: [] as number[],
    isProjectAdmin: false
  });
  const { toast } = useToast();

  // Fetch users with their project assignments
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .order('email');

      if (error) {
        toast({
          variant: "destructive",
          title: "Kullanıcılar yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      // Get project assignments for each user
      const enhancedUsers = await Promise.all(
        userData.map(async (user: User) => {
          const { data: projectData } = await supabase
            .from('project_users')
            .select(`
              project_id, 
              is_admin, 
              projects(id, name)
            `)
            .eq('user_id', user.id);

          return {
            ...user,
            projects: projectData?.map((p: any) => ({
              id: p.project_id,
              name: p.projects?.name || "Unknown Project",
              is_admin: p.is_admin
            })) || []
          };
        })
      );

      return enhancedUsers;
    }
  });

  // Fetch projects for assignment
  const { data: projects = [] } = useQuery({
    queryKey: ['admin', 'projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, is_active')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Project[];
    }
  });

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = () => {
    setCurrentUser(null);
    setFormData({
      email: '',
      password: '',
      role: 'project_user',
      selectedProjects: [],
      isProjectAdmin: false
    });
    setIsDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setFormData({
      email: user.email,
      password: '',
      role: user.role,
      selectedProjects: user.projects?.map(p => p.id) || [],
      isProjectAdmin: !!user.projects?.find(p => p.is_admin)
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setCurrentUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveUser = async () => {
    try {
      if (!formData.email) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "E-posta adresi zorunludur"
        });
        return;
      }

      if (!currentUser && !formData.password) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Şifre zorunludur"
        });
        return;
      }

      if (currentUser) {
        // Update existing user
        const { error } = await supabase
          .from('users')
          .update({
            role: formData.role
          })
          .eq('id', currentUser.id);

        if (error) throw error;

        // Remove existing project assignments
        await supabase
          .from('project_users')
          .delete()
          .eq('user_id', currentUser.id);

        // Add new project assignments
        if (formData.selectedProjects.length > 0) {
          const projectAssignments = formData.selectedProjects.map(projectId => ({
            user_id: currentUser.id,
            project_id: projectId,
            is_admin: formData.isProjectAdmin && formData.role === 'project_admin'
          }));

          const { error: assignError } = await supabase
            .from('project_users')
            .insert(projectAssignments);
            
          if (assignError) throw assignError;
        }
        
        toast({
          title: "Kullanıcı güncellendi",
          description: "Kullanıcı bilgileri başarıyla güncellendi"
        });
      } else {
        // Create new user
        const { data, error } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true
        });

        if (error) throw error;

        // Update role if not default
        if (formData.role !== 'project_user' && data.user) {
          const { error: roleError } = await supabase
            .from('users')
            .update({ role: formData.role })
            .eq('id', data.user.id);
            
          if (roleError) throw roleError;
        }

        // Add project assignments
        if (formData.selectedProjects.length > 0 && data.user) {
          const projectAssignments = formData.selectedProjects.map(projectId => ({
            user_id: data.user!.id,
            project_id: projectId,
            is_admin: formData.isProjectAdmin && formData.role === 'project_admin'
          }));

          const { error: assignError } = await supabase
            .from('project_users')
            .insert(projectAssignments);
            
          if (assignError) throw assignError;
        }
        
        toast({
          title: "Kullanıcı oluşturuldu",
          description: "Yeni kullanıcı başarıyla oluşturuldu"
        });
      }

      setIsDialogOpen(false);
      refetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Kullanıcı kaydedilirken bir hata oluştu"
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUser) return;

    try {
      const { error } = await supabase.auth.admin.deleteUser(currentUser.id);
      
      if (error) throw error;
      
      toast({
        title: "Kullanıcı silindi",
        description: "Kullanıcı başarıyla silindi"
      });
      
      setIsDeleteDialogOpen(false);
      refetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Kullanıcı silinirken bir hata oluştu"
      });
    }
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-bold px-4 py-2">Süper Admin</Badge>;
      case 'project_admin':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-bold px-4 py-2">Proje Yöneticisi</Badge>;
      case 'project_user':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold px-4 py-2">Kullanıcı</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 font-bold px-4 py-2">Bilinmiyor</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Kullanıcı Yönetimi
          </h3>
          <p className="text-purple-300 mt-2 text-lg">Sistem kullanıcılarını yönetin</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-400" />
            <Input
              type="search"
              placeholder="Kullanıcı ara..."
              className="w-80 pl-10 bg-white/10 border-white/20 text-white placeholder:text-purple-300 focus:bg-white/15 focus:border-purple-400 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleCreateUser}
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-xl shadow-xl hover:scale-105 transition-all duration-300 border-0"
          >
            <UserPlus className="h-5 w-5 mr-3" />
            Yeni Kullanıcı
          </Button>
        </div>
      </div>

      {/* Enhanced Table Container */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8">
          <Table>
            <TableHeader>
              <TableRow className="border-white/20 hover:bg-white/5">
                <TableHead className="text-purple-200 font-bold text-lg">E-posta</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Rol</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Atanmış Projeler</TableHead>
                <TableHead className="text-right text-purple-200 font-bold text-lg">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-16 text-purple-300 text-lg">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <UserPlus className="w-8 h-8 text-purple-400" />
                      </div>
                      <span>Kullanıcı bulunamadı</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id} className="border-white/10 hover:bg-white/5 transition-all duration-300 group">
                    <TableCell className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors duration-300">
                      {user.email}
                    </TableCell>
                    <TableCell>{getRoleDisplay(user.role)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.projects && user.projects.length > 0 ? (
                          user.projects.map((project) => (
                            <Badge 
                              key={project.id} 
                              variant="outline"
                              className={project.is_admin ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300" : ""}
                            >
                              {project.name} {project.is_admin && "(Admin)"}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">Proje atanmamış</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditUser(user)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-all duration-300 rounded-xl"
                        >
                          <Edit className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-300 rounded-xl"
                          onClick={() => handleDeleteClick(user)}
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* User Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}
            
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select 
                value={formData.role} 
                onValueChange={(value: 'super_admin' | 'project_admin' | 'project_user') => 
                  setFormData({ ...formData, role: value })}
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
              <>
                <div className="grid gap-2">
                  <Label>Projeler</Label>
                  <div className="bg-muted/50 p-4 rounded-md space-y-2 max-h-[200px] overflow-y-auto">
                    {projects.map((project) => (
                      <div key={project.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`project-${project.id}`}
                          checked={formData.selectedProjects.includes(project.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                selectedProjects: [...formData.selectedProjects, project.id]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                selectedProjects: formData.selectedProjects.filter(id => id !== project.id)
                              });
                            }
                          }}
                          className="h-4 w-4 rounded"
                        />
                        <label htmlFor={`project-${project.id}`} className="text-sm">
                          {project.name}
                        </label>
                      </div>
                    ))}
                    {projects.length === 0 && (
                      <p className="text-sm text-muted-foreground">Henüz proje bulunmamaktadır.</p>
                    )}
                  </div>
                </div>

                {formData.role === 'project_admin' && formData.selectedProjects.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isProjectAdmin"
                      checked={formData.isProjectAdmin}
                      onCheckedChange={(checked) => setFormData({ ...formData, isProjectAdmin: checked })}
                    />
                    <Label htmlFor="isProjectAdmin">Seçili projelerde yönetici yetkisine sahip olsun</Label>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveUser}>
              {currentUser ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kullanıcı Silme</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. "{currentUser?.email}" kullanıcısını silmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsersPanel;
