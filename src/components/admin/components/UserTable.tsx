import { capabilities } from "@/lib/capabilities";
import { useAuth } from "@/components/auth/AuthProvider";
import { roleLabel } from "@/lib/roleLabels";

import React from 'react';
import { Edit, Trash2, Mail } from 'lucide-react';
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
import { EmptyState } from "@/components/shared/EmptyState";

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
  const { profile } = useAuth();
  const canManage = capabilities(profile?.role).manageUsers;
  const getRoleDisplay = (role: string | undefined) => <Badge variant="secondary">{roleLabel(role)}</Badge>;


  return (
    <>
      <div className="rounded-lg border bg-card shadow-xs overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-posta</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8">
                  <EmptyState title="Kullanıcı bulunamadı" description="Aramanızı değiştirin veya yeni bir kullanıcı davet edin." />
                </TableCell>
              </TableRow>
            ) : (
              users.map((user, index) => (
                <TableRow key={String(user._id ?? user.email ?? index)}>
                  <TableCell className="font-medium">
                    {user.email ?? ""}
                  </TableCell>
                  <TableCell>{getRoleDisplay(user.role)}</TableCell>
                  <TableCell className="text-right">
                    {canManage && <div className="flex justify-end space-x-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        disabled
                        aria-label="Parola sıfırlama henüz kullanılamıyor"
                        title="Parola sıfırlama henüz kullanılamıyor"
                        className="h-8 w-8"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        aria-label="Kullanıcıyı düzenle"
                        onClick={() => onEditUser(user)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label="Kullanıcıyı sil"
                        onClick={() => onDeleteUser(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

    </>
  );
}
