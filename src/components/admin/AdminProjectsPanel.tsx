import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, Trash2, Hash, Users, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface ProjectForm {
  name: string;
  description: string;
  isActive: boolean;
}

const ROLE_BADGE: Record<string, { label: string; variant: "destructive" | "info" | "success" }> = {
  super_admin:   { label: "Süper Admin",       variant: "destructive" },
  project_admin: { label: "Proje Yöneticisi",  variant: "info" },
  project_user:  { label: "Kullanıcı",          variant: "success" },
};

const AdminProjectsPanel = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<Id<"projects"> | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<ProjectForm>({ name: "", description: "", isActive: true });
  const { toast } = useToast();

  const projectsData = useQuery(api.projects.list);
  const allUsersData = useQuery(api.users.list);
  const allUserProjectsData = useQuery(api.userProjects.getAll);
  const isLoading =
    projectsData === undefined ||
    allUsersData === undefined ||
    allUserProjectsData === undefined;
  const projects = projectsData ?? [];
  const allUsers = allUsersData ?? [];
  const allUserProjects = allUserProjectsData ?? [];

  const createProject = useMutation(api.projects.create);
  const updateProject = useMutation(api.projects.update);
  const removeProject = useMutation(api.projects.remove);

  const toggleProjectExpansion = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
  };

  const getProjectUsers = (projectId: Id<"projects">) => {
    const userIds = allUserProjects.filter((up: { projectId: Id<"projects"> }) => up.projectId === projectId).map((up: { userId: Id<"users"> }) => up.userId);
    return allUsers.filter((u: { _id: Id<"users"> }) => userIds.includes(u._id));
  };

  const getRoleDisplay = (role: string) => {
    const meta = ROLE_BADGE[role] ?? { label: "Bilinmiyor", variant: "secondary" as const };
    return <Badge variant={meta.variant}>{meta.label}</Badge>;
  };

  const handleCreateProject = () => {
    setCurrentProjectId(null);
    setFormData({ name: "", description: "", isActive: true });
    setIsDialogOpen(true);
  };

  const handleEditProject = (project: { _id: Id<"projects">; name: string; description?: string; isActive?: boolean }) => {
    setCurrentProjectId(project._id);
    setFormData({ name: project.name, description: project.description ?? "", isActive: project.isActive ?? true });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (projectId: Id<"projects">) => {
    setCurrentProjectId(projectId);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveProject = async () => {
    if (!formData.name) {
      toast({ variant: "destructive", title: "Hata", description: "Proje adı zorunludur" });
      return;
    }
    setIsSavingProject(true);
    try {
      if (currentProjectId) {
        await updateProject({ id: currentProjectId, name: formData.name, description: formData.description, isActive: formData.isActive });
        toast({ title: "Proje güncellendi", description: "Proje bilgileri başarıyla güncellendi" });
      } else {
        await createProject({ name: formData.name, description: formData.description });
        toast({ title: "Proje oluşturuldu", description: "Yeni proje başarıyla oluşturuldu" });
      }
      setIsDialogOpen(false);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Hata", description: (error as Error)?.message ?? "Proje kaydedilirken bir hata oluştu" });
    } finally {
      setIsSavingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProjectId) return;
    try {
      await removeProject({ id: currentProjectId });
      toast({ title: "Proje silindi", description: "Proje başarıyla silindi" });
      setIsDeleteDialogOpen(false);
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Hata", description: (error as Error)?.message ?? "Proje silinirken bir hata oluştu" });
    }
  };

  const currentProject = currentProjectId ? projects.find((p: { _id: Id<"projects"> }) => p._id === currentProjectId) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Proje Yönetimi</h3>
          <p className="text-sm text-muted-foreground">Sistemdeki tüm projeleri ve kullanıcıları yönetin</p>
        </div>
        <Button onClick={handleCreateProject}>
          <Plus className="h-4 w-4 mr-2" />
          Yeni Proje
        </Button>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><div className="flex items-center gap-1.5"><Hash className="w-4 h-4" /><span>ID</span></div></TableHead>
              <TableHead>Proje Adı</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Oluşturma Tarihi</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>Kullanıcılar</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Yükleniyor...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Henüz proje bulunmamaktadır
                </TableCell>
              </TableRow>
            ) : (
              projects.map((project: { _id: Id<"projects">; name: string; description?: string; isActive?: boolean; _creationTime?: number }) => {
                const projectUsersList = getProjectUsers(project._id);
                const isExpanded = expandedProjects.has(project._id);
                return (
                  <React.Fragment key={project._id}>
                    <TableRow>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {project._id.slice(-6)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {project.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project.description
                          ? project.description.length > 100
                            ? `${project.description.substring(0, 100)}...`
                            : project.description
                          : <span className="text-muted-foreground italic">Açıklama yok</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project._creationTime ? format(new Date(project._creationTime), "dd.MM.yyyy HH:mm") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.isActive ? "success" : "secondary"}>
                          {project.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => toggleProjectExpansion(project._id)} className="flex items-center gap-1.5">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          <Users className="h-4 w-4" />
                          <span>({projectUsersList.length})</span>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label="Projeyi düzenle" onClick={() => handleEditProject(project)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Projeyi sil" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(project._id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <div className="bg-muted/40 border-t p-4">
                            <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5">
                              <Users className="h-4 w-4" /><span>Proje Kullanıcıları</span>
                            </h4>
                            {projectUsersList.length === 0 ? (
                              <p className="text-muted-foreground text-sm italic">Bu projeye atanmış kullanıcı bulunmamaktadır</p>
                            ) : (
                              <div className="grid gap-2">
                                {projectUsersList.map((user: { _id: Id<"users">; email?: string; role?: string }) => (
                                  <div key={user._id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                      </div>
                                      <div>
                                        <p className="font-medium">{user.email}</p>
                                        <p className="text-muted-foreground text-xs">ID: {user._id.slice(-6)}</p>
                                      </div>
                                    </div>
                                    <div>{getRoleDisplay(user.role ?? "project_user")}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setCurrentProjectId(null);
            setFormData({ name: "", description: "", isActive: true });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentProjectId ? "Proje Düzenle" : "Yeni Proje"}</DialogTitle>
            <DialogDescription>
              {currentProjectId ? "Proje bilgilerini güncelleyin" : "Yeni bir proje ekleyin"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Proje Adı*</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">Açıklama</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="col-span-3" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>İptal</Button>
            <Button onClick={handleSaveProject} disabled={isSavingProject}>
              {isSavingProject ? (
                <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Kaydediliyor</>
              ) : (
                currentProjectId ? "Güncelle" : "Oluştur"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Proje Silme</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlem geri alınamaz. "{currentProject?.name}" projesini silmek istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleDeleteProject}>Sil</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminProjectsPanel;
