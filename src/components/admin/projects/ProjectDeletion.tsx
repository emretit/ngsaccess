import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { errorMessage, notify } from "@/lib/notify";
import { focusAdminHeading } from "../components/AdminListParts";
import { useAdminFormGuard } from "../hooks/useAdminFormGuard";
import type { Project } from "./projectSchema";
export function ProjectDeletion({
  project,
  onClose,
  onEdit,
}: {
  project: Project;
  onClose: () => void;
  onEdit: () => void;
}) {
  const impact = useQuery(api.projects.getDeletionImpact, {
    projectId: project._id,
  });
  const remove = useMutation(api.projects.remove);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  useAdminFormGuard("admin-project-delete", false, pending);
  const counts = (items: NonNullable<typeof impact>["cleanup"]) =>
    items.map(
      (item) => `${item.label}: ${item.count}${item.capped ? "+" : ""}`,
    );
  return (
    <>
      <Dialog
        open={!confirm}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proje silme etkileri</DialogTitle>
            <DialogDescription className="break-words">
              {project.name}
            </DialogDescription>
          </DialogHeader>
          {!impact ? (
            <SectionSkeleton label="Silme etkileri yükleniyor" />
          ) : (
            <div className="space-y-3 text-sm">
              {!impact.canDelete && (
                <>
                  <p role="alert">
                    Bu projeye bağlı iş verileri var; önce bunları taşıyın veya
                    silin. Geçmiş kayıtlarını korumak için projeyi pasife
                    alabilirsiniz.
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    {counts(impact.blockers).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </>
              )}
              <p className="font-medium">
                {impact.canDelete
                  ? "Silinecek bağlı kayıtlar"
                  : "Engeller kaldırıldığında silinecek bağlı kayıtlar"}
              </p>
              {impact.cleanup.length ? (
                <ul className="list-disc space-y-1 pl-5">
                  {counts(impact.cleanup).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p>Silinecek bağlı kayıt bulunmadı.</p>
              )}
              <p>Denetim geçmişi korunur. Silme işlemi geri alınamaz.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button variant="outline" onClick={onEdit}>
              Proje durumunu düzenle
            </Button>
            <Button
              variant="destructive"
              disabled={!impact?.canDelete}
              onClick={() => setConfirm(true)}
            >
              Silmeyi onayla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDestructive
        open={confirm}
        onOpenChange={(open) => {
          setConfirm(open);
        }}
        title="Proje silinsin mi?"
        objectName={project.name}
        effects={[
          "İş verisi varsa proje silinemez.",
          ...(impact ? counts(impact.cleanup) : []),
          "Ayarlar, kullanıcı üyelikleri, davetler ve sohbetler silinir; denetim geçmişi korunur.",
          "Bu işlem geri alınamaz.",
          ...(error
            ? [
                error,
                "Vazgeç ile etki dökümüne dönüp proje durumunu düzenleyebilirsiniz.",
              ]
            : []),
        ]}
        confirmLabel="Projeyi sil"
        onConfirm={async () => {
          if (!impact?.canDelete)
            throw new Error("Projeye bağlı iş verileri var.");
          setPending(true);
          setError(undefined);
          try {
            await remove({ id: project._id });
            notify.success("Proje silindi");
            focusAdminHeading("admin-projects-heading");
            onClose();
          } catch (cause) {
            setError(errorMessage(cause));
            throw cause;
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}
