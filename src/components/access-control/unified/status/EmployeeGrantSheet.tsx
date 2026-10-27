import type { RefObject } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmployeeStatus } from "./StatusViews";
import type { EmployeeDetail, GrantRow } from "./model";

export function EmployeeGrantSheet({
  employee,
  setEmployee,
  detail,
  detailError,
  returnFocusRef,
}: {
  employee: GrantRow | null;
  returnFocusRef?: RefObject<HTMLElement | null>;
  setEmployee: (employee: GrantRow | null) => void;
  detail: EmployeeDetail | null;
  detailError: string;
}) {
  return (
    <Sheet
      open={!!employee}
      onOpenChange={(open) => {
        if (!open) setEmployee(null);
      }}
    >
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus();
        }
      }}>
        <SheetHeader>
          <SheetTitle>{employee?.employeeName ?? "Kişi detayı"}</SheetTitle>
          <SheetDescription>
            Cihaz dağıtımları ve güncel kural yetkileri
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {detailError ? (
            <p role="alert">{detailError}</p>
          ) : detail ? (
            <EmployeeStatus detail={detail} />
          ) : (
            <p>Yükleniyor…</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
