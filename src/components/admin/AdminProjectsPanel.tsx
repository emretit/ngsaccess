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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Edit, Plus, Trash2, Hash, Users, ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

interface ProjectForm {
  name: string;
  description: string;
  isActive: boolean;
}

const AdminProjectsPanel = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState<Id<"projects"> | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<ProjectForm>({ name: "", description: "", isActive: true });
  const { toast } = useToast();

  const projects = useQuery(api.projects.list) ?? [];
  const allUsers = useQuery(api.users.list) ?? [];
  const allUserProjects = useQuery(api.userProjects.getAll) ?? [];

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
    switch (role) {
      case "super_admin":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-bold px-2 py-1">Süper Admin</Badge>;
      case "project_admin":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-bold px-2 py-1">Proje Yöneticisi</Badge>;
      case "project_user":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold px-2 py-1">Kullanıcı</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 font-bold px-2 py-1">Bilinmiyor</Badge>;
    }
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
    <div className="space-y-8">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-3xl font-bold bg-linear-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
            Proje Yönetimi
          </h3>
          <p className="text-purple-300 mt-2 text-lg">Sistemdeki tüm projeleri ve kullanıcıları yönetin</p>
        </div>
        <Button
          onClick={handleCreateProject}
          className="bg-linear-to-r from-purple-600 via-pink-600 to-blue-600 hover:from-purple-700 hover:via-pink-700 hover:to-blue-700 text-white font-bold px-8 py-4 rounded-xl shadow-xl hover:scale-105 transition-all duration-300 border-0"
        >
          <Plus className="h-5 w-5 mr-3" />
          Yeni Proje
        </Button>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8">
          <Table>
            <TableHeader>
              <TableRow className="border-white/20 hover:bg-white/5">
                <TableHead className="text-purple-200 font-bold text-lg"><div className="flex items-center space-x-2"><Hash className="w-5 h-5" /><span>ID</span></div></TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Proje Adı</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Açıklama</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Oluşturma Tarihi</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Durum</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Kullanıcılar</TableHead>
                <TableHead className="text-right text-purple-200 font-bold text-lg">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-16 text-purple-300 text-lg">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Plus className="w-8 h-8 text-purple-400" />
                      </div>
                      <span>Henüz proje bulunmamaktadır</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                projects.map((project: { _id: Id<"projects">; name: string; description?: string; isActive?: boolean; _creationTime?: number }) => {
                  const projectUsersList = getProjectUsers(project._id);
                  const isExpanded = expandedProjects.has(project._id);
                  return (
                    <React.Fragment key={project._id}>
                      <TableRow className="border-white/10 hover:bg-white/5 transition-all duration-300 group">
                        <TableCell className="font-mono text-purple-300 text-sm bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors duration-300 border border-purple-500/30">
                          {project._id.slice(-6)}
                        </TableCell>
                        <TableCell className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors duration-300">
                          {project.name}
                        </TableCell>
                        <TableCell className="text-purple-200">
                          {project.description
                            ? project.description.length > 100
                              ? `${project.description.substring(0, 100)}...`
                              : project.description
                            : <span className="text-purple-400 italic">Açıklama yok</span>}
                        </TableCell>
                        <TableCell className="text-purple-200">
                          {project._creationTime ? format(new Date(project._creationTime), "dd.MM.yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={project.isActive ? "default" : "secondary"}
                            className={project.isActive
                              ? "bg-green-500/20 text-green-400 border-green-500/30 font-bold px-4 py-2"
                              : "bg-gray-500/20 text-gray-400 border-gray-500/30 font-bold px-4 py-2"}
                          >
                            {project.isActive ? "Aktif" : "Pasif"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => toggleProjectExpansion(project._id)} className="flex items-center space-x-2 text-purple-300 hover:text-purple-100">
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            <Users className="h-4 w-4" />
                            <span>({projectUsersList.length})</span>
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProject(project)} className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-all duration-300 rounded-xl">
                              <Edit className="h-5 w-5" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(project._id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-300 rounded-xl">
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-0">
                            <div className="bg-white/5 border-t border-white/10 p-4">
                              <h4 className="text-purple-200 font-semibold mb-3 flex items-center space-x-2">
                                <Users className="h-4 w-4" /><span>Proje Kullanıcıları</span>
                              </h4>
                              {projectUsersList.length === 0 ? (
                                <p className="text-purple-400 text-sm italic">Bu projeye atanmış kullanıcı bulunmamaktadır</p>
                              ) : (
                                <div className="grid gap-3">
                                  {projectUsersList.map((user: { _id: Id<"users">; email?: string; role?: string }) => (
                                    <div key={user._id} className="flex items-center justify-between bg-white/5 rounded-lg p-3 border border-white/10">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-purple-500/30 rounded-full flex items-center justify-center">
                                          <Users className="h-4 w-4 text-purple-300" />
                                        </div>
                                        <div>
                                          <p className="text-white font-medium">{user.email}</p>
                                          <p className="text-purple-300 text-xs">ID: {user._id.slice(-6)}</p>
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
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
            <Button onClick={handleSaveProject}>{currentProjectId ? "Güncelle" : "Oluştur"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proje Silme</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. "{currentProject?.name}" projesini silmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>İptal</Button>
            <Button variant="destructive" onClick={handleDeleteProject}>Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProjectsPanel;
