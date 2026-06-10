
import React, { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { RefreshCw } from 'lucide-react';
import ProjectFilter from '@/components/auth/ProjectFilter';
import { UserTableHeader } from './components/UserTableHeader';
import { UserTable } from './components/UserTable';
import { UserFormDialog } from './components/UserFormDialog';
import { DeleteUserDialog } from './components/DeleteUserDialog';
import { useUserManagement } from './hooks/useUserManagement';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { api } from '../../../convex/_generated/api';
import type { User } from './types/user-types';

const AdminUsersPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const expiredInvites = useQuery(api.invites.listExpired) ?? [];
  const sendInviteEmail = useAction(api.actions.sendEmail.sendUserInviteEmail);

  const handleResendInvite = async (email: string, projectId: string, role: "project_admin" | "project_user") => {
    setResendingId(email);
    try {
      await sendInviteEmail({ email, projectId: projectId as Parameters<typeof sendInviteEmail>[0]["projectId"], role });
      toast({ title: "Davet yeniden gönderildi", description: `${email} adresine yeni davet maili gönderildi.` });
    } catch (error: unknown) {
      toast({ title: "Hata", description: (error as Error)?.message ?? "Davet gönderilemedi", variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const {
    users,
    projects,
    currentUser,
    formData,
    setFormData,
    handleEditUser,
    handleSaveUser,
    handleDeleteUser,
    resetForm
  } = useUserManagement();

  const filteredUsers = users.filter((user: User) =>
    (user.email ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = () => {
    resetForm?.();
    setIsDialogOpen(true);
  };

  const handleEditClick = async (user: User) => {
    await handleEditUser(user);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    const success = await handleSaveUser();
    if (success) {
      setIsDialogOpen(false);
    }
  };

  const handleDelete = async () => {
    if (userToDelete) {
      await handleDeleteUser(userToDelete);
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <ProjectFilter requiredRole="admin">
      <div className="space-y-8">
        <UserTableHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateUser={handleCreateUser}
        />

        <UserTable
          users={filteredUsers}
          onEditUser={handleEditClick}
          onDeleteUser={handleDeleteClick}
        />

        <UserFormDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          currentUser={currentUser}
          formData={formData}
          onFormDataChange={setFormData}
          onSave={handleSave}
          projects={projects}
        />

        <DeleteUserDialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          user={userToDelete}
          onDelete={handleDelete}
        />

        {expiredInvites.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Süresi Dolmuş Davetler</h3>
            <div className="rounded-lg border divide-y">
              {expiredInvites.map((inv) => (
                <div key={inv._id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{inv.email}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {new Date(inv.expiresAt).toLocaleDateString("tr-TR")} tarihinde doldu
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={resendingId === inv.email}
                    onClick={() => void handleResendInvite(inv.email, inv.projectId, inv.role)}
                  >
                    <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${resendingId === inv.email ? "animate-spin" : ""}`} />
                    Yeniden gönder
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ProjectFilter>
  );
};

export default AdminUsersPanel;
