import { usePermissions } from "@/hooks/usePermissions";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useActiveProject, useProjectChangeGuard } from "@/contexts/ActiveProjectContext";
import { installNavigationGuard } from "@/lib/navigationGuard";
import type { Employee } from "@/types/employee";
import type { EmployeeFormDraft } from "./hooks/useEmployeeFormData";
import type { EmployeeSaveResult } from "./hooks/useEmployeeFormSubmit";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import EmployeeForm from "./EmployeeForm";
import EmployeeDetails from "./EmployeeDetails";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (payload: EmployeeSaveResult) => void;
  onContinue?: (payload: EmployeeSaveResult) => void;
  loadingEmployee?: boolean;
}
export default function SlideOverPanel({
  isOpen,
  onClose,
  employee,
  onSave,
  onContinue,
  loadingEmployee = false,
}: Props) {
  const draft = useRef<EmployeeFormDraft | undefined>(undefined);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  // Kaydet/Vazgeç sonrası formu güncel kayıtla yeniden kurar.
  const [formVersion, setFormVersion] = useState(0);
  const { can } = usePermissions();
  const canManage = can("employees.manage");
  const { projectId } = useActiveProject();
  const previousProject = useRef(projectId);
  const guard = useUnsavedChangesGuard(dirty && isOpen);
  const { requestClose } = guard;
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const close = () => {
    if (!pending) guard.requestClose(onClose);
  };
  const clearDraft = useCallback(() => {
    draft.current = undefined;
    setDirty(false);
    setPending(false);
  }, []);
  const resetForm = () => {
    draft.current = undefined;
    setDirty(false);
    setFormVersion((version) => version + 1);
  };
  useEffect(() => {
    if (!isOpen) {
      draft.current = undefined;
      setDirty(false);
      setPending(false);
      previousProject.current = projectId;
    }
  }, [isOpen, projectId]);
  useProjectChangeGuard(isOpen && (dirty || pending), pending ? () => {} : requestClose);
  // Drawer içi bağlantılar ve tarayıcı geri/ileri de taslağı uyarısız silmesin.
  useEffect(() => {
    if (!isOpen || (!dirty && !pending)) return;
    return installNavigationGuard(navigator, (proceed) => {
      if (!pending) requestClose(proceed);
    }, window, pending);
  }, [isOpen, dirty, pending, navigator, requestClose]);
  useEffect(() => {
    if (!isOpen || previousProject.current === projectId) return;
    previousProject.current = projectId;
    onClose();
  }, [projectId, isOpen, onClose]);
  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent
          size="lg"
          aria-describedby="employee-drawer-description"
          className="flex max-w-full flex-col gap-0 p-0 sm:w-[700px] sm:max-w-[700px] md:max-w-[700px]"
          onOpenAutoFocus={(e) => {
            // Düzenlemede ilk odak riskli eylem (İşten çıkar) değil başlık olsun.
            if (!employee) return;
            e.preventDefault();
            titleRef.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 space-y-1 border-b px-5 py-3">
            <SheetTitle ref={titleRef} tabIndex={-1} className="outline-none">
              {!employee && !loadingEmployee
                ? "Personel ekle"
                : canManage
                  ? "Personel düzenle"
                  : "Personel ayrıntısı"}
            </SheetTitle>
            <SheetDescription id="employee-drawer-description">
              {employee && !canManage
                ? "Kimlik, erişim ve cihaz bilgileri"
                : "Zorunlu alanlar * ile işaretlidir."}
            </SheetDescription>
          </SheetHeader>
          <div
            className={`min-h-0 min-w-0 flex-1 ${employee || loadingEmployee ? "overflow-y-auto px-5 py-4" : "overflow-hidden"}`}
          >
            {loadingEmployee ? <SectionSkeleton label="Personel bilgileri yükleniyor" /> : employee ? (
              <EmployeeDetails
                onClose={onClose}
                onGone={clearDraft}
                employee={employee}
                renderEditForm={(current) => (
                  <EmployeeForm
                    embedded
                    draft={draft}
                    key={`${current._id}-${formVersion}`}
                    employee={current}
                    autoFocusFirstName={formVersion > 0}
                    onClose={resetForm}
                    onExit={onClose}
                    onSave={(payload) => {
                      resetForm();
                      onSave(payload);
                    }}
                    onDirtyChange={setDirty}
                    onPendingChange={setPending}
                  />
                )}
              />
            ) : (
              <EmployeeForm
                key="new"
                employee={null}
                onClose={close}
                onSave={(payload) => {
                  setDirty(false);
                  onSave(payload);
                }}
                onContinue={onContinue ? (payload) => { setDirty(false); onContinue(payload); } : undefined}
                onDirtyChange={setDirty}
                onPendingChange={setPending}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
      {guard.dialog}
    </>
  );
}
