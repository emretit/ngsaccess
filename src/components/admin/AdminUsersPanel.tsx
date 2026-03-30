// @ts-nocheck

import React, { useState } from 'react';
import ProjectFilter from '@/components/auth/ProjectFilter';
import { UserTableHeader } from './components/UserTableHeader';
import { UserTable } from './components/UserTable';
import { UserFormDialog } from './components/UserFormDialog';
import { DeleteUserDialog } from './components/DeleteUserDialog';
import { useUserManagement } from './hooks/useUserManagement';

const AdminUsersPanel = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

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

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateUser = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEditClick = async (user) => {
    await handleEditUser(user);
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (user) => {
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
      </div>
    </ProjectFilter>
  );
};

export default AdminUsersPanel;
