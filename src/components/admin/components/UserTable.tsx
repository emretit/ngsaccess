import { capabilities } from "@/lib/capabilities";
import { useAuth } from "@/components/auth/AuthProvider";
import { roleLabel } from "@/lib/roleLabels";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RowActions } from "@/components/shared/RowActions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { userName, type User } from "../types/user-types";

export function UserTable({
  users,
  onEditUser,
  onDeleteUser,
}: {
  users: User[];
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
}) {
  const { profile } = useAuth();
  const canManage = capabilities(profile?.role).manageUsers;
  const membership = (user: User) =>
    user.role === "super_admin"
      ? "Tüm projeler (etkili erişim)"
      : "projects" in user
        ? user.projects.map((project) => project.name).join(", ") ||
          "Ataması yok"
        : "Yetkili proje kapsamı";
  const role = (user: User) => (
    <StatusBadge tone="neutral">
      {user.role ? roleLabel(user.role) : "Rol atanmamış"}
    </StatusBadge>
  );
  const actions = (user: User) =>
    canManage && (
      <RowActions label={`${userName(user)} kullanıcı işlemleri`}>
        <DropdownMenuItem onSelect={() => onEditUser(user)}>
          Düzenle
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          disabled={"isSelf" in user && user.isSelf}
          onSelect={() => onDeleteUser(user)}
        >
          {"isSelf" in user && user.isSelf
            ? "Kendi hesabınızı silemezsiniz"
            : "Kullanıcıyı sil"}
        </DropdownMenuItem>
      </RowActions>
    );
  const identity = (user: User) => (
    <>
      <p className="break-words font-medium">{userName(user)}</p>
      {user.email && userName(user) !== user.email && <p className="break-all text-xs text-muted-foreground">{user.email}</p>}
      {"pendingSetup" in user && user.pendingSetup && (
        <p className="text-xs text-muted-foreground">
          E-posta doğrulaması bekliyor
        </p>
      )}
    </>
  );
  return (
    <>
      <div className="hidden min-w-0 overflow-x-auto rounded-md border min-[761px]:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[38%]">Kullanıcı</TableHead>
              <TableHead className="w-[20%]">Rol</TableHead>
              <TableHead>Projeler</TableHead>
              <TableHead className="w-14">
                <span className="sr-only">İşlemler</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user._id}>
                <TableCell>{identity(user)}</TableCell>
                <TableCell>{role(user)}</TableCell>
                <TableCell className="break-words">
                  {membership(user)}
                </TableCell>
                <TableCell className="px-1">{actions(user)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul
        aria-label="Kullanıcılar"
        className="divide-y rounded-md border min-[761px]:hidden"
      >
        {users.map((user) => (
          <li key={user._id} className="flex min-w-0 gap-2 p-3">
            <div className="min-w-0 flex-1 space-y-2">
              {identity(user)}
              {role(user)}
              <p className="break-words text-xs text-muted-foreground">
                {membership(user)}
              </p>
            </div>
            {actions(user)}
          </li>
        ))}
      </ul>
    </>
  );
}
