import { usePermissions } from "@/hooks/usePermissions";
import { useCallback, useEffect, useRef, useState } from "react";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { useGuardedFormNavigation } from "@/hooks/useGuardedFormNavigation";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
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
  const guard = useGuardedFormNavigation({ active: isOpen, dirty, pending });
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
  useEffect(() => {
    if (!isOpen || previousProject.current === projectId) return;
    previousProject.current = projectId;
    onClose();
  }, [projectId, isOpen, onClose]);
  return (
    <>
      <DetailSheet
        open={isOpen}
        onRequestClose={close}
        pending={pending}
        size="lg"
        focusTitleOnOpen={Boolean(employee)}
        descriptionId="employee-drawer-description"
        headerClassName="border-b"
        bodyClassName="flex min-h-0 flex-col overflow-hidden"
        title={!employee && !loadingEmployee ? "Personel ekle" : canManage ? "Personel düzenle" : "Personel ayrıntısı"}
        description={employee && !canManage ? "Kimlik, erişim ve cihaz bilgileri" : "Zorunlu alanlar * ile işaretlidir."}
      >
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
      </DetailSheet>
      {guard.dialog}
    </>
  );
}
