import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { EmploymentEmployee as Employee } from "./lib/employment";
import type { Employee as FormEmployee } from "@/types/employee";
import { terminationLabels } from "./lib/employment";
import { EmployeeEmploymentBadge } from "./EmployeeEmploymentBadge";
import { EmployeeEmploymentActions } from "./EmployeeEmploymentActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmployeeActivityBoundary } from "./EmployeeActivityBoundary";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { EmployeeRecentReadings } from "./EmployeeRecentReadings";
import { EmployeeFingerprintCard } from "./EmployeeFingerprintCard";
import { EmployeeConsentsCard } from "./EmployeeConsentsCard";
export default function EmployeeDetails({
  employee,
  renderEditForm,
  onClose,
  onGone,
}: {
  employee: Employee | null;
  onClose: () => void;
  /** Kayıt silinince açık taslağın kirli/bekliyor durumu temizlensin. */
  onGone?: () => void;
  /** Yöneticide Genel bilgiler bölümü güncel kayıtla yerinde düzenleme formu olur. */
  renderEditForm?: (current: FormEmployee) => ReactNode;
}) {
  const { isAdmin, projectId } = useActiveProjectScope();
  const employees = useQuery(api.employees.list, projectId ? { projectId } : "skip");
  const record = useQuery(api.employees.getById, employee ? { employeeId: employee._id } : "skip");
  const listed = employee ? employees?.find(item => item._id === employee._id) : undefined;
  const gone = !!employee && (record === null || (employees !== undefined && !listed));
  useEffect(() => {
    if (gone) onGone?.();
  }, [gone, onGone]);
  if (!employee) return null;
  const editing = isAdmin && !!renderEditForm;
  if (gone) {
    return (
      <div className="[&_button]:max-sm:min-h-11">
        <EmptyState
          title="Personel kaydı artık bulunamıyor."
          action={{ label: "Listeye dön", onClick: onClose }}
        />
      </div>
    );
  }
  const current = listed ?? employee;
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
    <div className="min-w-0 space-y-4 break-words">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">
              {current.firstName} {current.lastName}
            </h2>
            <EmployeeEmploymentBadge employee={current} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {current.payrollCode || "Bordro kodu yok"}
          </p>
          {current.employmentEndDate && <p className="mt-1 text-xs text-muted-foreground">{current.terminationType ? terminationLabels[current.terminationType] : "Ayrılış"}{current.terminationReason ? ` · ${current.terminationReason}` : ""}</p>}
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2"><EmployeeEmploymentActions key={current._id} employee={current} /></div>
        )}
      </div>
      <section className="border-t pt-4">
        {/* Düzenleme formunun kendi bölüm başlıkları var; üst başlık yalnız salt-okunurda. */}
        {editing ? (
          <EmployeeActivityBoundary employeeId={employee._id} projectId={projectId} title="Personel formu" description="Form yüklenemedi.">
            {renderEditForm(current)}
          </EmployeeActivityBoundary>
        ) : (
          <>
          <h3 className="mb-3 text-base font-semibold">Genel bilgiler</h3>
          <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
            {items.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-sm">{value || "—"}</dd>
              </div>
            ))}
          </dl>
          </>
        )}
      </section>
      {!editing && (
        <EmployeeActivityBoundary employeeId={employee._id} projectId={projectId} title="Erişim yetkileri" description="Erişim yetkileri yüklenemedi.">
          <EmployeeAccessSection employeeId={employee._id} />
        </EmployeeActivityBoundary>
      )}
      {/* Cihaz senkron sorunları Kişiler sayfasındaki senkron uyarıları bandında; drawer'da tekrarlanmaz. */}
      <EmployeeActivityBoundary employeeId={employee._id} projectId={projectId} title="Parmak izi" description="Parmak izi kayıtları yüklenemedi.">
        <EmployeeFingerprintCard key={employee._id} employeeId={employee._id} />
      </EmployeeActivityBoundary>
      {/* key: çalışan değişince açık rıza/iptal formu önceki çalışanda kalmasın. */}
      <EmployeeActivityBoundary
        key={employee._id}
        employeeId={employee._id}
        projectId={projectId}
        title="KVKK rızaları"
        description="Rıza kayıtları yüklenemedi."
      >
        <EmployeeConsentsCard employeeId={employee._id} />
      </EmployeeActivityBoundary>
      {/* Düzenleme ekranı yalnız kişi bilgisi + rıza/biyometri; geçişler Canlı İzleme geçmişinde. */}
      {!editing && (
        <EmployeeActivityBoundary
          employeeId={employee._id}
          projectId={projectId}
          title="Son geçişler"
          description="Son geçişler yüklenemedi."
        >
          <EmployeeRecentReadings employeeId={employee._id} />
        </EmployeeActivityBoundary>
      )}
      {/* Düzenlemede fotoğraf formun içinde; ikinci kez gösterilmez. */}
      {!editing && <section className="space-y-3 border-t pt-4">
        <h3 className="text-base font-semibold">Fotoğraf</h3>
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
      </section>}
    </div>
  );
}

function EmployeeAccessSection({ employeeId }: { employeeId: Employee["_id"] }) {
  const { projectId, isAdmin } = useActiveProjectScope();
  const rules = useQuery(
    api.accessRules.list,
    projectId ? { projectId } : "skip",
  );
  const memberships = rules?.filter((rule) =>
    rule.groupMembers.some((member) => member.employeeId === employeeId),
  );
  return (
    <section className="space-y-3 border-t pt-4">
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
        <Link className="inline-flex items-center max-sm:min-h-11 text-sm underline" to="/access-control">
          Geçiş Kontrol{isAdmin ? " · Üyelikleri yönet" : ""}
        </Link>
      </section>
  );
}
