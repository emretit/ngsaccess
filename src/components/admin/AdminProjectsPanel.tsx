
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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Project {
  id: number;
  name: string;
  description: string;
  created_at: string;
  is_active: boolean;
}

const AdminProjectsPanel = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    description: '',
    is_active: true
  });
  const { toast } = useToast();

  // Fetch projects
  const { data: projects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['admin', 'projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        toast({
          variant: "destructive",
          title: "Projeler yüklenirken hata",
          description: error.message
        });
        throw error;
      }
      return data as Project[];
    }
  });

  const handleCreateProject = () => {
    setCurrentProject(null);
    setFormData({
      name: '',
      description: '',
      is_active: true
    });
    setIsDialogOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setCurrentProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      is_active: project.is_active
    });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (project: Project) => {
    setCurrentProject(project);
    setIsDeleteDialogOpen(true);
  };

  const handleSaveProject = async () => {
    try {
      if (!formData.name) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Proje adı zorunludur"
        });
        return;
      }

      if (currentProject) {
        // Update existing project
        const { error } = await supabase
          .from('projects')
          .update({
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active
          })
          .eq('id', currentProject.id);

        if (error) throw error;
        
        toast({
          title: "Proje güncellendi",
          description: "Proje bilgileri başarıyla güncellendi"
        });
      } else {
        // Create new project
        const { error } = await supabase
          .from('projects')
          .insert({
            name: formData.name,
            description: formData.description,
            is_active: true
          });

        if (error) throw error;
        
        toast({
          title: "Proje oluşturuldu",
          description: "Yeni proje başarıyla oluşturuldu"
        });
      }

      setIsDialogOpen(false);
      refetchProjects();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Proje kaydedilirken bir hata oluştu"
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!currentProject) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', currentProject.id);

      if (error) throw error;
      
      toast({
        title: "Proje silindi",
        description: "Proje başarıyla silindi"
      });
      
      setIsDeleteDialogOpen(false);
      refetchProjects();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Hata",
        description: error.message || "Proje silinirken bir hata oluştu"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Projeler</CardTitle>
          <Button onClick={handleCreateProject} className="ml-auto">
            <Plus className="h-4 w-4 mr-2" /> Yeni Proje
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proje Adı</TableHead>
                  <TableHead>Açıklama</TableHead>
                  <TableHead>Oluşturma Tarihi</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                      Henüz proje bulunmamaktadır
                    </TableCell>
                  </TableRow>
                ) : (
                  projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
                      <TableCell>
                        {project.description ? 
                          project.description.length > 100 ? 
                            `${project.description.substring(0, 100)}...` : 
                            project.description : 
                          <span className="text-muted-foreground italic">Açıklama yok</span>}
                      </TableCell>
                      <TableCell>
                        {project.created_at ? format(new Date(project.created_at), 'dd.MM.yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.is_active ? "default" : "secondary"}>
                          {project.is_active ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleEditProject(project)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteClick(project)}>
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

      {/* Project Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentProject ? 'Proje Düzenle' : 'Yeni Proje'}</DialogTitle>
            <DialogDescription>
              {currentProject ? 'Proje bilgilerini güncelleyin' : 'Yeni bir proje ekleyin'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Proje Adı*
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description" className="text-right">
                Açıklama
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="col-span-3"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSaveProject}>
              {currentProject ? 'Güncelle' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proje Silme</DialogTitle>
            <DialogDescription>
              Bu işlem geri alınamaz. "{currentProject?.name}" projesini silmek istediğinize emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProjectsPanel;
