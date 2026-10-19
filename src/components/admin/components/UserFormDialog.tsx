import { useState } from "react";
import { Link } from "react-router-dom";
import { roleLabel } from "@/lib/roleLabels";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAdminFormGuard } from "../hooks/useAdminFormGuard";
import {
  userFormSchema,
  type User,
  type UserFormData,
  type Project,
  type UserRole,
} from "../types/user-types";
import type { Id } from "../../../../convex/_generated/dataModel";

const roleRank: Record<UserRole, number> = {
  project_user: 0,
  project_admin: 1,
  super_admin: 2,
};
export function UserFormDialog({
  isOpen,
  onClose,
  currentUser,
  formData,
  baseline,
  onFormDataChange,
  onSave,
  isSaving = false,
  editReady = true,
  projects,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  formData: UserFormData;
  baseline: UserFormData;
  onFormDataChange: (data: UserFormData) => void;
  onSave: () => Promise<boolean>;
  isSaving?: boolean;
  editReady?: boolean;
  projects: Project[];
  error?: string;
}) {
  const [search, setSearch] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const dirty = isOpen && JSON.stringify({ ...formData, projectIds: [...(formData.projectIds ?? [])].sort() }) !== JSON.stringify({ ...baseline, projectIds: [...(baseline.projectIds ?? [])].sort() });
  const guard = useAdminFormGuard("admin-user", dirty, isOpen && isSaving);
  const close = () => {
    if (!isSaving) guard.requestClose(onClose);
  };
  const removed = (baseline.projectIds ?? []).filter(
    (id) => !formData.projectIds?.includes(id),
  );
  const added = (formData.projectIds ?? []).filter(
    (id) => !baseline.projectIds?.includes(id),
  );
  const names = (ids: Id<"projects">[]) =>
    ids
      .map(
        (id) =>
          projects.find((project) => project._id === id)?.name ??
          "Silinmiş proje",
      )
      .join(", ") || "Yok";
  const reducing =
    currentUser &&
    (roleRank[formData.role] < roleRank[baseline.role] || removed.length > 0);
  const elevating = currentUser && baseline.role !== "super_admin" && formData.role === "super_admin";
  const emailValid = userFormSchema.shape.email.safeParse(
    formData.email,
  ).success;
  const save = async () => {
    if (!(await onSave()))
      throw new Error(
        "Değişiklikler kaydedilemedi; formdaki hata mesajını kontrol edin.",
      );
  };
  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]"
          aria-busy={isSaving}
        >
          <DialogHeader>
            <DialogTitle>
              {currentUser ? "Kullanıcıyı düzenle" : "Kullanıcı davet et"}
            </DialogTitle>
            <DialogDescription>
              {currentUser
                ? "Rol ve proje üyeliklerini düzenleyin."
                : "Kullanıcıya seçilen proje için davet e-postası gönderilir."}
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              setSubmitted(true);
              if (!currentUser && (!emailValid || !formData.projectId)) return;
              if (reducing || elevating) setConfirm(true);
              else void onSave();
            }}
            className="min-w-0 space-y-4"
          >
            <FormFieldWrapper
              htmlFor="admin-user-email"
              label="E-posta"
              error={
                submitted && !currentUser && !emailValid
                  ? "Geçerli bir e-posta adresi girin."
                  : undefined
              }
            >
              <Input
                type="email"
                autoComplete="email"
                readOnly={!!currentUser}
                disabled={isSaving}
                value={formData.email}
                onChange={(event) =>
                  onFormDataChange({ ...formData, email: event.target.value })
                }
              />
            </FormFieldWrapper>
            <FormFieldWrapper
              htmlFor="admin-user-role"
              label="Rol"
              hint="Rol hesabın tamamı için geçerlidir; proje erişimi aşağıda seçilir."
            >
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                disabled={
                  isSaving ||
                  (currentUser !== null && !editReady) ||
                  (currentUser !== null &&
                    "isSelf" in currentUser &&
                    currentUser.isSelf)
                }
                value={formData.role}
                onChange={(event) =>
                  onFormDataChange({
                    ...formData,
                    role: event.target.value as UserRole,
                  })
                }
              >
                {currentUser && (
                  <option value="super_admin">
                    {roleLabel("super_admin")}
                  </option>
                )}
                <option value="project_admin">
                  {roleLabel("project_admin")}
                </option>
                <option value="project_user">
                  {roleLabel("project_user")}
                </option>
              </select>
            </FormFieldWrapper>
            {currentUser && "isSelf" in currentUser && currentUser.isSelf && (
              <p className="text-xs text-muted-foreground">
                Kendi rolünüzü düşüremezsiniz.
              </p>
            )}
            {currentUser ? (
              <div className="space-y-3">
                <Label htmlFor="admin-membership-search">
                  Proje üyelikleri
                </Label>
                {!editReady ? (
                  <SectionSkeleton label="Üyelikler yükleniyor" rows={3} />
                ) : (
                  <>
                    <Input
                      id="admin-membership-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Proje ara"
                    />
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {projects
                        .filter((project) =>
                          project.name
                            .toLocaleLowerCase("tr-TR")
                            .includes(search.toLocaleLowerCase("tr-TR")),
                        )
                        .map((project) => (
                          <label
                            key={project._id}
                            className="flex min-h-9 items-center gap-2 text-sm"
                          >
                            <Checkbox
                              disabled={isSaving}
                              checked={
                                formData.projectIds?.includes(project._id) ??
                                false
                              }
                              onCheckedChange={(checked) =>
                                onFormDataChange({
                                  ...formData,
                                  projectIds: checked
                                    ? [
                                        ...(formData.projectIds ?? []),
                                        project._id,
                                      ]
                                    : (formData.projectIds ?? []).filter(
                                        (id) => id !== project._id,
                                      ),
                                })
                              }
                            />
                            <span className="min-w-0 break-words">
                              {project.name}
                              {!project.isActive ? " · Pasif" : ""}
                            </span>
                          </label>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formData.role === "super_admin"
                        ? "Tüm projelere erişir. Saklanan üyelikler, rol düşürülürse erişilecek projeleri belirler."
                        : "Yalnız işaretli projelere erişir."}
                    </p>
                    <div className="space-y-1 rounded-md border p-3 text-xs">
                      <p className="break-words">Eklenen: {names(added)}</p>
                      <p className="break-words">
                        Kaldırılan: {names(removed)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <FormFieldWrapper
                  htmlFor="admin-invite-project"
                  label="Proje (zorunlu)"
                  error={
                    submitted && !formData.projectId
                      ? "Bir proje seçin."
                      : undefined
                  }
                >
                  <select
                    className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm"
                    disabled={isSaving || !editReady || projects.length === 0}
                    value={formData.projectId ?? ""}
                    onChange={(event) =>
                      onFormDataChange({
                        ...formData,
                        projectId: event.target.value
                          ? (event.target.value as Id<"projects">)
                          : undefined,
                      })
                    }
                  >
                    <option value="">Bir proje seçin</option>
                    {projects.map((project) => (
                      <option key={project._id} value={project._id}>
                        {project.name}
                        {!project.isActive ? " · Pasif" : ""}
                      </option>
                    ))}
                  </select>
                </FormFieldWrapper>
                {editReady && projects.length === 0 && (
                  <p className="text-sm">
                    Henüz proje yok.{" "}
                    <Link className="underline" to="/system-admin?tab=projects">
                      Önce bir proje oluşturun.
                    </Link>
                  </p>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="break-words text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={isSaving}
              >
                Vazgeç
              </Button>
              <Button
                type="submit"
                disabled={
                  isSaving ||
                  !editReady ||
                  (!currentUser && projects.length === 0)
                }
              >
                {isSaving
                  ? "İşlem sürüyor…"
                  : currentUser
                    ? "Kaydet"
                    : "Davet gönder"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {guard.dialog}
      <ConfirmDestructive
        open={isOpen && confirm}
        onOpenChange={setConfirm}
        title="Erişim değişikliği kaydedilsin mi?"
        objectName={formData.email}
        effects={[
          ...(elevating ? ["Kullanıcı tüm projelere ve Admin sayfasına erişim kazanır."] : []),
          `Rol: ${roleLabel(baseline.role)} → ${roleLabel(formData.role)}.`,
          `Kaldırılan projeler: ${names(removed)}.`,
          `Kalan erişim: ${formData.role === "super_admin" ? "Tüm projeler" : names(formData.projectIds ?? [])}.`,
          ...(error ? [error] : []),
        ]}
        confirmLabel="Erişimi güncelle"
        onConfirm={save}
      />
    </>
  );
}
