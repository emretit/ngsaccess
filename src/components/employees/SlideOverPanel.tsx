import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import type { Employee } from "@/types/employee";
import EmployeeForm from "./EmployeeForm";
import EmployeeDetails from "./EmployeeDetails";
interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSave: (payload?: unknown) => void;
  viewMode?: boolean;
}
export default function SlideOverPanel({
  isOpen,
  onClose,
  employee,
  onSave,
  viewMode = false,
}: Props) {
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const { projectId, setActiveProjectId } = useActiveProject();
  const previousProject = useRef(projectId);
  const guard = useUnsavedChangesGuard(!viewMode && dirty && isOpen);
  const close = () => {
    if (!pending) guard.requestClose(onClose);
  };
  useEffect(() => {
    if (!isOpen) {
      setDirty(false);
      setPending(false);
      previousProject.current = projectId;
    }
  }, [isOpen, projectId]);
  useEffect(() => {
    if (!isOpen || previousProject.current === projectId) return;
    const previous = previousProject.current;
    const next = projectId;
    if (previous && (dirty || pending)) {
      setActiveProjectId(previous);
      if (!pending)
        guard.requestClose(() => {
          setDirty(false);
          onClose();
          if (next) setActiveProjectId(next);
        });
    } else {
      previousProject.current = projectId;
      onClose();
    }
  }, [projectId, isOpen, dirty, pending, setActiveProjectId, guard, onClose]);
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
          className="flex max-w-full flex-col gap-0 p-0 sm:w-[700px] sm:max-w-[700px] md:max-w-[700px]"
          onEscapeKeyDown={(e) => {
            if (pending) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (pending) e.preventDefault();
          }}
        >
          <SheetHeader className="shrink-0 border-b p-5">
            <SheetTitle>
              {viewMode
                ? "Personel ayrıntısı"
                : employee
                  ? "Personel düzenle"
                  : "Personel ekle"}
            </SheetTitle>
            <SheetDescription>
              {viewMode
                ? "Kimlik, erişim ve cihaz bilgileri"
                : "Zorunlu alanlar * ile işaretlidir."}
            </SheetDescription>
          </SheetHeader>
          <div
            className={`min-h-0 min-w-0 flex-1 ${viewMode ? "overflow-y-auto p-5" : "overflow-hidden"}`}
          >
            {viewMode ? (
              <EmployeeDetails
                onClose={close}
                employee={employee}
                onEdit={() => onSave(employee)}
              />
            ) : (
              <EmployeeForm
                key={employee?._id ?? "new"}
                employee={employee}
                onClose={close}
                onSave={(payload) => {
                  setDirty(false);
                  onSave(payload);
                }}
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
