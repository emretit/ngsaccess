import { Link } from "react-router-dom";
import type { Employee } from "@/types/employee";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmployeeActivityBoundary } from "./EmployeeActivityBoundary";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EmployeeSyncSection } from "./EmployeeSyncSection";
import { EmployeeRecentReadings } from "./EmployeeRecentReadings";
import { EmployeeConsentsCard } from "./EmployeeConsentsCard";
export default function EmployeeDetails({
  employee,
  onEdit,
}: {
  employee: Employee | null;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { isAdmin, projectId } = useActiveProjectScope();
  const rules = useQuery(
    api.accessRules.list,
    projectId ? { projectId } : "skip",
  );
  if (!employee) return null;
  const current = employee;
  const memberships = rules?.filter((rule) =>
    rule.groupMembers.some((member) => member.employeeId === current._id),
  );
  const items = [
    ["E-posta", current.email],
    ["Departman", current.departments?.name],
    ["Pozisyon", current.positions?.name],
    ["Kart no", current.cardNumber],
    ["Bordro kodu", current.payrollCode],
    ["TC kimlik no", current.tcNo ? `•••••••${current.tcNo.slice(-4)}` : null],
    ["Eski vardiya notu", current.shift],
  ];
  return (
    <div className="min-w-0 space-y-6 break-words">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">
            {current.firstName} {current.lastName}
          </h2>
          <p className="my-2 text-xs text-muted-foreground">
            {current.payrollCode || "Bordro kodu yok"}
          </p>
          <StatusBadge tone={current.isActive ? "success" : "neutral"}>
            {current.isActive ? "Aktif" : "Pasif"}
          </StatusBadge>
        </div>
        {isAdmin && (
          <Button variant="outline" onClick={onEdit}>
            Düzenle
          </Button>
        )}
      </div>
      <section className="border-t pt-5">
        <h3 className="mb-4 text-base font-semibold">Genel bilgiler</h3>
        <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
          {items.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm">{value || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-3 border-t pt-5">
        <h3 className="text-base font-semibold">Erişim yetkileri</h3>
        {memberships === undefined ? (
          <SectionSkeleton label="Erişim yetkileri yükleniyor" />
        ) : memberships.length === 0 ? (
          <EmptyState compact title="Bu kişiye erişim kuralı atanmamış." />
        ) : (
          <ul className="divide-y">
            {memberships.map((rule) => (
              <li
                key={rule._id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span>{rule.name}</span>
                <StatusBadge
                  tone={rule.isActive === false ? "neutral" : "success"}
                >
                  {rule.isActive === false ? "Pasif" : "Aktif"}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
        <Link className="text-sm underline" to="/access-control">
          Geçiş Kontrol{isAdmin ? " · Üyelikleri yönet" : ""}
        </Link>
      </section>
      <EmployeeActivityBoundary
        employeeId={employee._id}
        projectId={projectId}
        title="Cihaz senkron durumu"
        description="Cihaz senkron durumu yüklenemedi."
      >
        <EmployeeSyncSection employeeId={employee._id} />
      </EmployeeActivityBoundary>
      {/* key: çalışan değişince açık rıza/iptal formu önceki çalışanda kalmasın. */}
      <EmployeeActivityBoundary
        key={employee._id}
        employeeId={employee._id}
        projectId={projectId}
        title="KVKK Rızalar"
        description="Rıza kayıtları yüklenemedi."
      >
        <EmployeeConsentsCard employeeId={employee._id} />
      </EmployeeActivityBoundary>
      <EmployeeActivityBoundary
        employeeId={employee._id}
        projectId={projectId}
        title="Son geçişler"
        description="Son geçişler yüklenemedi."
      >
        <EmployeeRecentReadings employeeId={employee._id} />
      </EmployeeActivityBoundary>
      <section className="space-y-3 border-t pt-5">
        <h3 className="text-base font-semibold">Fotoğraf ve veri kayıtları</h3>
        {current.photoUrl ? (
          <img
            src={current.photoUrl}
            alt={`${current.firstName} ${current.lastName}`}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Fotoğraf eklenmemiş.</p>
        )}
        <p className="text-xs text-muted-foreground">
          Fotoğraf personel profilinde kullanılır.
        </p>
      </section>
    </div>
  );
}
