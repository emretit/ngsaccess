
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
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { AdminDataBoundary } from "./components/AdminDataBoundary";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { api } from '../../../convex/_generated/api';
import type { User } from './types/user-types';

const AdminUsersContent = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const isSuperAdmin = useQuery(api.users.isSuperAdmin);
  const expiredInvites = useQuery(api.invites.listExpired, isSuperAdmin === true ? {} : "skip") ?? [];
  const sendInviteEmail = useAction(api.actions.sendEmail.sendUserInviteEmail);

  const { run: resendInvite, pending: resending } = useAsyncAction(async (email: string, projectId: Parameters<typeof sendInviteEmail>[0]["projectId"], role: "project_admin" | "project_user") => {
    const result = await sendInviteEmail({ email, projectId, role });
    if (!result.success) throw new Error(result.error ?? "Davet gönderilemedi.");
  }, { success: "Davet yeniden gönderildi" });
  const handleResendInvite = async (email: string, projectId: Parameters<typeof sendInviteEmail>[0]["projectId"], role: "project_admin" | "project_user") => {
    setResendingId(email);
    await resendInvite(email, projectId, role);
    setResendingId(null);
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
    resetForm, saving, editReady, loading
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

  if (loading) return <SectionSkeleton label="Kullanıcılar yükleniyor" />;
  return (
    <ProjectFilter requiredRole="admin">
      <div className="space-y-8">
        <UserTableHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateUser={handleCreateUser}
        />

        {filteredUsers.length === 0 ? <EmptyState title={searchQuery ? "Aramaya uygun kullanıcı yok" : "Henüz kullanıcı yok"} description={searchQuery ? "E-posta aramasını değiştirin veya temizleyin." : "Kullanıcı ekleyerek bir davet gönderin."} /> : <UserTable
          users={filteredUsers}
          onEditUser={handleEditClick}
          onDeleteUser={handleDeleteClick}
        />}

        <UserFormDialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          currentUser={currentUser}
          formData={formData}
          onFormDataChange={setFormData}
          onSave={handleSave}
          isSaving={saving || !editReady}
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
                    disabled={resending}
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

export default function AdminUsersPanel() {
  return <ProjectFilter requiredRole="admin"><AdminDataBoundary label="Kullanıcılar"><AdminUsersContent /></AdminDataBoundary></ProjectFilter>;
}
