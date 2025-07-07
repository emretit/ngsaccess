
import React, { useState } from 'react';
import { Edit, Trash2, UserPlus, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { User } from '../types/user-types';
import { UserPasswordResetDialog } from './UserPasswordResetDialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserTableProps {
  users: User[];
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}

export const UserTable: React.FC<UserTableProps> = ({
  users,
  onEditUser,
  onDeleteUser
}) => {
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
  const [showPasswordResetDialog, setShowPasswordResetDialog] = useState(false);

  // Fetch user projects for each user
  const { data: userProjects = [] } = useQuery({
    queryKey: ['admin', 'user-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_projects')
        .select(`
          user_id,
          project_id,
          projects:project_id (
            id,
            name
          )
        `);

      if (error) throw error;
      return data;
    }
  });

  const handlePasswordResetClick = (user: User) => {
    setSelectedUserForReset(user);
    setShowPasswordResetDialog(true);
  };

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'super_admin':
        return <Badge variant="destructive">Süper Admin</Badge>;
      case 'project_admin':
        return <Badge className="bg-primary text-primary-foreground">Proje Yöneticisi</Badge>;
      case 'project_user':
        return <Badge variant="secondary">Kullanıcı</Badge>;
      default:
        return <Badge variant="outline">Bilinmiyor</Badge>;
    }
  };

  const getUserProjects = (userId: string) => {
    const projects = userProjects.filter(up => up.user_id === userId);
    if (projects.length === 0) {
      return <span className="text-muted-foreground text-sm">Proje atanmamış</span>;
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {projects.map((up) => (
          <Badge 
            key={up.project_id} 
            variant="outline" 
            className="text-xs"
          >
            ID: {up.project_id} - {up.projects?.name || 'Bilinmiyor'}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Projeler</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <span className="text-muted-foreground">Kullanıcı bulunamadı</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.email}
                  </TableCell>
                  <TableCell>{getRoleDisplay(user.role)}</TableCell>
                  <TableCell className="max-w-xs">
                    {getUserProjects(user.id)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handlePasswordResetClick(user)}
                        className="h-8 w-8"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => onEditUser(user)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteUser(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <UserPasswordResetDialog
        isOpen={showPasswordResetDialog}
        onOpenChange={setShowPasswordResetDialog}
        user={selectedUserForReset}
      />
    </>
  );
}
