
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
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-bold px-4 py-2">Süper Admin</Badge>;
      case 'project_admin':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 font-bold px-4 py-2">Proje Yöneticisi</Badge>;
      case 'project_user':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold px-4 py-2">Kullanıcı</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 font-bold px-4 py-2">Bilinmiyor</Badge>;
    }
  };

  const getUserProjects = (userId: string) => {
    const projects = userProjects.filter(up => up.user_id === userId);
    if (projects.length === 0) {
      return <span className="text-purple-400 text-sm">Proje atanmamış</span>;
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {projects.map((up) => (
          <Badge 
            key={up.project_id} 
            variant="outline" 
            className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30"
          >
            ID: {up.project_id} - {up.projects?.name || 'Bilinmiyor'}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="bg-white/5 backdrop-blur-xl border border-white/20 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-8">
          <Table>
            <TableHeader>
              <TableRow className="border-white/20 hover:bg-white/5">
                <TableHead className="text-purple-200 font-bold text-lg">E-posta</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Rol</TableHead>
                <TableHead className="text-purple-200 font-bold text-lg">Projeler</TableHead>
                <TableHead className="text-right text-purple-200 font-bold text-lg">İşlemler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
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
                users.map((user) => (
                  <TableRow key={user.id} className="border-white/10 hover:bg-white/5 transition-all duration-300 group">
                    <TableCell className="font-bold text-white text-lg group-hover:text-purple-300 transition-colors duration-300">
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
                          className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/20 transition-all duration-300 rounded-xl"
                        >
                          <Mail className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => onEditUser(user)}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 transition-all duration-300 rounded-xl"
                        >
                          <Edit className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/20 transition-all duration-300 rounded-xl"
                          onClick={() => onDeleteUser(user)}
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

      <UserPasswordResetDialog
        isOpen={showPasswordResetDialog}
        onOpenChange={setShowPasswordResetDialog}
        user={selectedUserForReset}
      />
    </>
  );
}
