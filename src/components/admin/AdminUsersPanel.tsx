import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAdminPrimaryAction } from "./hooks/useAdminPrimaryAction";
import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import ProjectFilter from "@/components/auth/ProjectFilter";
import { useAuth } from "@/components/auth/AuthProvider";
import { roleLabel } from "@/lib/roleLabels";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/shared/FilterBar";
import { StatInline } from "@/components/shared/StatInline";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  AdminEmptyState as EmptyState,
  focusAdminHeading,
} from "./components/AdminListParts";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { errorMessage } from "@/lib/notify";
import { UserTable } from "./components/UserTable";
import { UserFormDialog } from "./components/UserFormDialog";
import { DeleteUserDialog } from "./components/DeleteUserDialog";
import { useUserManagement } from "./hooks/useUserManagement";
import { AdminDataBoundary } from "./components/AdminDataBoundary";
import {
  AdminSelect,
  AdminPageSize,
  AdminPagination,
  adminDate,
  useAdminPagination,
} from "./components/AdminListParts";
import type { User } from "./types/user-types";

type Filters = Pick<
  FunctionArgs<typeof api.users.adminList>,
  "search" | "role" | "project"
>;
function ExpiredInvites({
  projects,
}: {
  projects: ReturnType<typeof useUserManagement>["projects"];
}) {
  const invites = useQuery(api.invites.listExpired, {});
  const send = useAction(api.actions.sendEmail.sendUserInviteEmail);
  const [failed, setFailed] = useState<{ id: string; message: string }>();
  const { run, pending } = useAsyncAction(
    async (invite: NonNullable<typeof invites>[number]) => {
      setFailed(undefined);
      try {
        const result = await send({
          email: invite.email,
          projectId: invite.projectId,
          role: invite.role,
        });
        if (!result.success)
          throw new Error(result.error ?? "Davet gönderilemedi.");
      } catch (error) {
        setFailed({ id: invite._id, message: errorMessage(error) });
        throw error;
      }
    },
    { success: "Davet yeniden gönderildi" },
  );
  return (
    <section className="min-w-0 space-y-3">
      <h3 className="text-base font-semibold">Süresi dolan davetler</h3>
      <p className="text-xs text-muted-foreground">
        En yeni 50 kullanılmamış davet gösterilir.
      </p>
      {invites === undefined ? (
        <SectionSkeleton label="Süresi dolan davetler yükleniyor" />
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Süresi dolan davet yok</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {invites.map((invite) => (
            <li
              key={invite._id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="min-w-0 flex-1 basis-48 space-y-1">
                <p className="break-all text-sm font-medium">{invite.email}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {roleLabel(invite.role)} ·{" "}
                  {projects.find((project) => project._id === invite.projectId)
                    ?.name ?? "Proje bilgisi yok"}{" "}
                  · {adminDate(invite.expiresAt)}
                </p>
                <StatusBadge tone="warning">Süresi doldu</StatusBadge>
                {failed?.id === invite._id && (
                  <p
                    role="alert"
                    className="break-words text-sm text-destructive"
                  >
                    {failed.message}
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => void run(invite)}
              >
                Yeniden gönder
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
function AdminUsersContent() {
  const { profile } = useAuth();
  const superAdmin = profile?.role === "super_admin";
  const [filters, setFilters] = useState<Filters>({});
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const queryFilters = { ...filters, search: debouncedSearch };
  const paging = useAdminPagination(JSON.stringify(queryFilters));
  const result = useQuery(
    api.users.adminList,
    superAdmin
      ? {
          ...queryFilters,
          paginationOpts: { numItems: paging.size, cursor: paging.cursor },
        }
      : "skip",
  );
  const scoped = useQuery(api.users.list, !superAdmin ? {} : "skip");
  const management = useUserManagement();
  const [open, setOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const users = superAdmin
    ? result?.page
    : scoped?.filter(
        (user) =>
          `${user.fullName ?? ""} ${user.email ?? ""}`
            .toLocaleLowerCase("tr-TR")
            .includes((filters.search ?? "").toLocaleLowerCase("tr-TR")) &&
          (!filters.role || user.role === filters.role),
      );
  const create = () => {
    management.resetForm();
    setOpen(true);
  };
  const primaryInHeader = useAdminPrimaryAction("Kullanıcı davet et", create);
  const filtered = Boolean(filters.search || filters.role || filters.project);
  return (
    <div className="min-w-0 space-y-5">
      <h2 id="admin-users-heading" tabIndex={-1} className="sr-only">
        Kullanıcılar
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatInline
          loading={users === undefined}
          items={[
            {
              label: superAdmin ? "Bu sayfada" : "Gösterilen kullanıcı",
              value: users?.length,
            },
          ]}
        />
        {!primaryInHeader && (
          <Button onClick={create}>Kullanıcı davet et</Button>
        )}
      </div>
      <FilterBar
        search={filters.search ?? ""}
        onSearchChange={(search) => setFilters({ ...filters, search })}
        placeholder="Ad veya e-posta ara"
        searchLabel="Kullanıcı ara"
        hasFilters={filtered}
        onClear={() => setFilters({})}
        end={
          superAdmin && (
            <AdminPageSize size={paging.size} onChange={paging.setSize} />
          )
        }
      >
        <AdminSelect
          label="Rol"
          value={filters.role ?? "all"}
          onChange={(value) =>
            setFilters({
              ...queryFilters,
              role: value === "all" ? undefined : (value as Filters["role"]),
            })
          }
        >
          <option value="all">Tüm roller</option>
          {(["super_admin", "project_admin", "project_user"] as const).map(
            (role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ),
          )}
        </AdminSelect>
        {superAdmin && (
          <AdminSelect
            label="Proje"
            value={filters.project ?? "all"}
            onChange={(value) =>
              setFilters({
                ...queryFilters,
                project:
                  value === "all" ? undefined : (value as Filters["project"]),
              })
            }
          >
            <option value="all">Tüm projeler</option>
            <option value="none">Ataması yok</option>
            {management.projects.map((project) => (
              <option key={project._id} value={project._id}>
                {project.name}
              </option>
            ))}
          </AdminSelect>
        )}
      </FilterBar>
      {users === undefined ? (
        <SectionSkeleton label="Kullanıcılar yükleniyor" />
      ) : users.length === 0 && result && !result.isDone ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bu sayfada eşleşme yok. Tarama devam ediyor; sonraki sayfaya geçin.
        </p>
      ) : users.length === 0 && paging.page > 1 ? (
        <p role="status" className="text-sm text-muted-foreground">
          Bu sayfada kayıt yok. Önceki sayfaya dönebilir veya filtreleri
          değiştirebilirsiniz.
        </p>
      ) : users.length === 0 ? (
        <EmptyState
          title={
            filtered ? "Filtrelere uygun kayıt yok" : "Henüz kullanıcı yok"
          }
          description={
            filtered
              ? "Aramayı veya filtreleri değiştirin."
              : "Erişim vermek için bir kullanıcı davet edin."
          }
          action={{
            label: filtered ? "Filtreleri temizle" : "Kullanıcı davet et",
            onClick: filtered ? () => setFilters({}) : create,
          }}
        />
      ) : (
        <UserTable
          users={users}
          onEditUser={(user) => {
            management.handleEditUser(user);
            setOpen(true);
          }}
          onDeleteUser={(user) => {
            setDeleteUser(user);
            setDeleteOpen(true);
          }}
        />
      )}
      {superAdmin && (
        <AdminPagination
          page={paging.page}
          count={users?.length ?? 0}
          done={result?.isDone ?? false}
          loading={!result}
          onPrevious={paging.previous}
          onNext={() => {
            if (result && !result.isDone) paging.next(result.continueCursor);
          }}
        />
      )}
      {open && (
        <UserFormDialog
          isOpen
          onClose={() => setOpen(false)}
          currentUser={management.currentUser}
          formData={management.formData}
          baseline={management.baseline}
          onFormDataChange={management.setFormData}
          onSave={async () => {
            const success = await management.handleSaveUser();
            if (success) setOpen(false);
            return success;
          }}
          isSaving={management.saving}
          editReady={management.editReady}
          projects={management.projects}
          error={management.error}
        />
      )}
      <DeleteUserDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        user={deleteUser}
        onDelete={async () => {
          if (deleteUser) {
            await management.handleDeleteUser(deleteUser);
            focusAdminHeading("admin-users-heading");
          }
        }}
      />
      {superAdmin && (
        <AdminDataBoundary label="Süresi dolan davetler">
          <ExpiredInvites projects={management.projects} />
        </AdminDataBoundary>
      )}
    </div>
  );
}
export default function AdminUsersPanel() {
  return (
    <ProjectFilter requiredRole="admin">
      <AdminDataBoundary label="Kullanıcılar">
        <AdminUsersContent />
      </AdminDataBoundary>
    </ProjectFilter>
  );
}
