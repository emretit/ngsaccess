
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
import { UserPlus, Edit, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";

interface User {
  id: string;
  email: string;
  role: 'super_admin' | 'project_admin' | 'project_user';
  projects?: { id: number; name: string; is_admin: boolean }[];
  created_at: string;
}

interface Project {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
}

export function UserManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"super_admin" | "project_admin" | "project_user">("project_user");
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  // Fetch users with their roles and project assignments
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

      // Get project assignments for each user
      const enhancedUsers = await Promise.all(
        usersData.map(async (user: User) => {
          const { data: projectData } = await supabase
            .from("project_users")
            .select("project_id, is_admin, projects(id, name)")
            .eq("user_id", user.id);

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
    },
  });

  // Fetch projects for assignment
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (error) {
        throw error;
      }
      return data as Project[];
    },
  });

  const filteredUsers = users.filter((user: User) => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRole("project_user");
    setSelectedProjects([]);
    setIsAdmin(false);
    setEditingUser(null);
  };

  const handleOpenDialog = (user?: User) => {
    resetForm();
    if (user) {
      setEditingUser(user);
      setEmail(user.email);
      setRole(user.role);
      setSelectedProjects(user.projects?.map(p => p.id) || []);
      setIsAdmin(!!user.projects?.find(p => p.is_admin));
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

          // Add project assignments
          if (selectedProjects.length > 0) {
            const projectAssignments = selectedProjects.map(projectId => ({
              user_id: data.user!.id,
              project_id: projectId,
              is_admin: isAdmin && role === "project_admin"
            }));

            await supabase.from("project_users").insert(projectAssignments);
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

        // Remove existing project assignments
        await supabase
          .from("project_users")
          .delete()
          .eq("user_id", editingUser.id);

        // Add new project assignments
        if (selectedProjects.length > 0) {
          const projectAssignments = selectedProjects.map(projectId => ({
            user_id: editingUser.id,
            project_id: projectId,
            is_admin: isAdmin && role === "project_admin"
          }));

          await supabase.from("project_users").insert(projectAssignments);
        }

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
                  <TableHead>Projeler</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
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
                        <div className="flex flex-wrap gap-1">
                          {user.projects && user.projects.length > 0 ? (
                            user.projects.map((project) => (
                              <Badge 
                                key={project.id} 
                                variant="outline" 
                                className={project.is_admin ? "bg-blue-100 text-blue-800" : ""}
                              >
                                {project.name} {project.is_admin && "(Admin)"}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">Proje atanmamış</span>
                          )}
                        </div>
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

            {role !== "super_admin" && (
              <>
                <div className="space-y-2">
                  <Label>Projeler</Label>
                  <div className="bg-muted/50 p-4 rounded-md space-y-2 max-h-[200px] overflow-y-auto">
                    {projects.map((project) => (
                      <div key={project.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`project-${project.id}`}
                          checked={selectedProjects.includes(project.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProjects([...selectedProjects, project.id]);
                            } else {
                              setSelectedProjects(selectedProjects.filter(id => id !== project.id));
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

                {role === "project_admin" && selectedProjects.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isAdmin"
                      checked={isAdmin}
                      onCheckedChange={setIsAdmin}
                    />
                    <Label htmlFor="isAdmin">Seçili projelerde yönetici yetkisine sahip olsun</Label>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateUser}>
              {editingUser ? "Güncelle" : "Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
