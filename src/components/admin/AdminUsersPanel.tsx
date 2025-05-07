
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, UserPlus, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  projects?: { id: number; name: string }[];
}

const AdminUsersPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'project_user' as 'super_admin' | 'project_admin' | 'project_user'
  });
  const { toast } = useToast();

  // Fetch users
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data: userData, error } = await supabase
        .from('users_with_projects')
        .select('*');

      if (error) {
        toast({
          variant: "destructive",
          title: "Kullanıcılar yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      // Group projects by user
      const usersMap = new Map();
      
      userData.forEach(user => {
        if (!usersMap.has(user.id)) {
          usersMap.set(user.id, {
            id: user.id,
            email: user.email,
            role: user.role,
            projects: []
          });
        }
        
        if (user.project_id) {
          usersMap.get(user.id).projects.push({
            id: user.project_id,
            name: user.project_name,
            is_admin: user.is_admin
          });
        }
      });
      
      return Array.from(usersMap.values());
    }
  });

  // Fetch projects (for selecting in dialogs)
  const { data: projects = [] } = useQuery({
    queryKey: ['admin', 'projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('name');

      if (error) throw error;
      return data;
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
      role: 'project_user'
    });
    setIsDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setFormData({
      email: user.email,
      password: '',
      role: user.role
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
        return <Badge variant="destructive">Süper Admin</Badge>;
      case 'project_admin':
        return <Badge variant="default">Proje Yöneticisi</Badge>;
      case 'project_user':
        return <Badge variant="secondary">Kullanıcı</Badge>;
      default:
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kullanıcılar</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Kullanıcı ara..."
                className="w-full md:w-[250px] pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button onClick={handleCreateUser}>
              <UserPlus className="h-4 w-4 mr-2" />
              Yeni Kullanıcı
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Atanmış Projeler</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Kullanıcı bulunamadı
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
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
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteClick(user)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* User Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</DialogTitle>
            <DialogDescription>
              {currentUser ? 'Kullanıcı bilgilerini güncelleyin' : 'Sisteme yeni bir kullanıcı ekleyin'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-medium">
                E-posta*
              </label>
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
                <label htmlFor="password" className="text-sm font-medium">
                  Şifre*
                </label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}
            
            <div className="grid gap-2">
              <label htmlFor="role" className="text-sm font-medium">
                Rol
              </label>
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

      {/* Delete Confirmation Dialog */}
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
