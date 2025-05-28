
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Plus, Trash2, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  created_at: string;
}

const AdminUsersPanel = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    email: '',
    role: 'project_user'
  });
  const { toast } = useToast();

  // Fetch users
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          variant: "destructive",
          title: "Kullanıcılar yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      
      return data as User[];
    }
  });

  const handleCreateUser = () => {
    setCurrentUser(null);
    setFormData({
      email: '',
      role: 'project_user'
    });
    setIsDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setCurrentUser(user);
    setFormData({
      email: user.email,
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
          email: formData.email!,
          email_confirm: true
        });

        if (error) throw error;

        if (data.user && formData.role !== 'project_user') {
          await supabase
            .from('users')
            .update({ role: formData.role })
            .eq('id', data.user.id);
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kullanıcılar</CardTitle>
          <Button onClick={handleCreateUser} className="ml-auto">
            <Plus className="h-4 w-4 mr-2" /> Yeni Kullanıcı
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Oluşturma Tarihi</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Henüz kullanıcı bulunmamaktadır
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            user.role === 'super_admin' ? 'destructive' : 
                            user.role === 'project_admin' ? 'default' : 'secondary'
                          }
                        >
                          {user.role === 'super_admin' ? 'Süper Admin' : 
                           user.role === 'project_admin' ? 'Proje Yöneticisi' : 'Kullanıcı'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.created_at ? format(new Date(user.created_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(user)}>
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
              {currentUser ? 'Kullanıcı bilgilerini güncelleyin' : 'Yeni bir kullanıcı ekleyin'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                E-posta*
              </Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="col-span-3"
                disabled={!!currentUser}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                Rol
              </Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Süper Admin</SelectItem>
                  <SelectItem value="project_admin">Proje Yöneticisi</SelectItem>
                  <SelectItem value="project_user">Kullanıcı</SelectItem>
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
