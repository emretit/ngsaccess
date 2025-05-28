
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Edit, Trash2, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/AuthProvider";

interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  created_at: string;
}

export function UserManagement() {
  const { checkUserRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"super_admin" | "project_admin" | "project_user">("project_user");
  const { toast } = useToast();

  // Check if user has super_admin access
  if (!checkUserRole('super_admin')) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Erişim Yetkisi Yok</h3>
            <p className="text-gray-600 mt-2">Bu sayfaya erişim için süper admin yetkisine sahip olmanız gerekiyor.</p>
          </div>
        </div>
      </div>
    );
  }

  // Fetch users (project_users referansını kaldırdık)
  const { data: users = [], refetch: refetchUsers } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .order("email");

      if (usersError) {
        throw usersError;
      }

      return usersData as User[];
    },
  });

  const filteredUsers = users.filter((user: User) => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRole("project_user");
    setEditingUser(null);
  };

  const handleOpenDialog = (user?: User) => {
    resetForm();
    if (user) {
      setEditingUser(user);
      setEmail(user.email);
      setRole(user.role);
    }
    setDialogOpen(true);
  };

  const handleCreateUser = async () => {
    try {
      if (!editingUser) {
        // Creating a new user
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

        if (error) throw error;

        if (data.user) {
          // Update the user's role if it's not the default
          if (role !== "project_user") {
            await supabase
              .from("users")
              .update({ role })
              .eq("id", data.user.id);
          }

          toast({
            title: "Kullanıcı oluşturuldu",
            description: "Yeni kullanıcı başarıyla eklendi.",
          });
        }
      } else {
        // Editing existing user
        await supabase
          .from("users")
          .update({ role })
          .eq("id", editingUser.id);

        toast({
          title: "Kullanıcı güncellendi",
          description: "Kullanıcı bilgileri başarıyla güncellendi.",
        });
      }

      resetForm();
      setDialogOpen(false);
      refetchUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Kullanıcı işlemi sırasında bir hata oluştu.",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) {
      try {
        const { error } = await supabase.auth.admin.deleteUser(userId);
        
        if (error) throw error;
        
        toast({
          title: "Kullanıcı silindi",
          description: "Kullanıcı başarıyla silindi.",
        });
        
        refetchUsers();
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: error.message || "Kullanıcı silinirken bir hata oluştu.",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Kullanıcı Yönetimi</CardTitle>
            <Button onClick={() => handleOpenDialog()}>
              <UserPlus className="mr-2 h-4 w-4" />
              Yeni Kullanıcı
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Input 
                  placeholder="Kullanıcı ara..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kullanıcı Adı</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Durum</TableHead>
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
                  filteredUsers.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={user.role === "super_admin" ? "destructive" : 
                                 user.role === "project_admin" ? "default" : "secondary"}
                        >
                          {user.role === "super_admin" ? "Süper Admin" : 
                           user.role === "project_admin" ? "Proje Yöneticisi" : "Kullanıcı"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch id={`active-${user.id}`} defaultChecked />
                          <Label htmlFor={`active-${user.id}`}>Aktif</Label>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenDialog(user)}
                          className="h-8 w-8"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteUser(user.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Kullanıcı Düzenle" : "Yeni Kullanıcı Ekle"}</DialogTitle>
            <DialogDescription>
              {editingUser ? "Kullanıcı bilgilerini değiştirin" : "Sisteme yeni bir kullanıcı ekleyin"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@sirket.com"
                disabled={!!editingUser}
              />
            </div>
            
            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Şifre</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Güçlü bir şifre girin"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Kullanıcı Rolü</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Kullanıcı rolü seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="super_admin">Süper Admin</SelectItem>
                    <SelectItem value="project_admin">Proje Yöneticisi</SelectItem>
                    <SelectItem value="project_user">Standart Kullanıcı</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateUser}>
              {editingUser ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
