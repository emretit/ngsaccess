import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { EmployeeActivityBoundary } from "./EmployeeActivityBoundary";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeDetails from "./EmployeeDetails";

vi.mock("react-router-dom", () => ({ Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a> }));
const scope = vi.hoisted(() => ({ isAdmin: false, deleted: false, recordDeleted: false, boundaries: [] as string[], emptyAction: undefined as (() => void) | undefined }));
vi.mock("@/components/shared/EmptyState", () => ({ EmptyState: ({ title, action }: { title: string; action?: { onClick: () => void } }) => { scope.emptyAction = action?.onClick; return <p>{title}</p>; } }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ isAdmin: scope.isAdmin, projectId: "project-a" }) }));
vi.mock("./EmployeeEmploymentActions", () => ({ EmployeeEmploymentActions: () => null }));
vi.mock("./EmployeeFingerprintCard", () => ({ EmployeeFingerprintCard: () => null }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0]) => {
  const name = getFunctionName(ref);
  if (name === "employees:list") return scope.deleted ? [] : [employee];
  if (name === "employees:getById") return scope.recordDeleted ? null : employee;
  return [];
} }));
vi.mock("./EmployeeActivityBoundary", () => ({ EmployeeActivityBoundary: ({ title, children }: { title: string; children: ReactNode }) => { scope.boundaries.push(title); return children; } }));
vi.mock("./EmployeeRecentReadings", () => ({ EmployeeRecentReadings: () => <div data-testid="readings" /> }));
vi.mock("./EmployeeConsentsCard", () => ({
  EmployeeConsentsCard: ({ employeeId }: { employeeId: string }) => <div data-testid="consents" data-employee-id={employeeId} />,
}));

const employee: Employee = {
  _id: "employee-a" as Id<"employees">,
  firstName: "Ada",
  lastName: "Test",
  email: "ada@example.test",
  cardNumber: "123",
  isActive: true,
};

beforeEach(() => { scope.isAdmin = false; scope.deleted = false; scope.recordDeleted = false; scope.boundaries = []; });

describe("çalışan ayrıntısı", () => {
  it("KVKK rıza kartını seçili çalışan için son geçişlerin üstünde gösterir", () => {
    const html = renderToStaticMarkup(<EmployeeDetails employee={employee} onClose={() => undefined} />);
    expect(html).toContain('data-employee-id="employee-a"');
    expect(html).toContain("Genel bilgiler");
    expect(html).toContain(">Fotoğraf</h3>");
    expect(html.indexOf('data-testid="consents"')).toBeLessThan(html.indexOf('data-testid="readings"'));
  });

  it("yönetici düzenlemesinde çift başlık ve ikinci fotoğraf bloğu çizmez", () => {
    scope.isAdmin = true;
    try {
      const html = renderToStaticMarkup(<EmployeeDetails employee={employee} onClose={() => undefined} renderEditForm={() => <form data-testid="edit-form" />} />);
      expect(html).toContain('data-testid="edit-form"');
      expect(html).not.toContain("Genel bilgiler");
      expect(html).not.toContain("Erişim yetkileri");
      expect(scope.boundaries).toContain("Personel formu");
      expect(html).not.toContain(">Fotoğraf</h3>");
      expect(html).not.toContain('data-testid="readings"');
    } finally {
      scope.isAdmin = false;
    }
  });

  it("çalışan yokken hiçbir bölüm, rıza kartı dahil, çizmez", () => {
    const html = renderToStaticMarkup(<EmployeeDetails employee={null} onClose={() => undefined} />);
    expect(html).toBe("");
  });
});

it.each(["list", "record"])("silinmiş kayıtta tek boş durum ve gerçek kapatma: %s", (source) => {
  scope.deleted = source === "list";
  scope.recordDeleted = source === "record";
  const onClose = vi.fn();
  const html = renderToStaticMarkup(<EmployeeDetails employee={employee} onClose={onClose} />);
  expect(html.match(/Personel kaydı artık bulunamıyor/g)).toHaveLength(1);
  expect(html).not.toContain("Genel bilgiler");
  expect(html).not.toContain("data-testid");
  // EmptyState'e verilen gerçek eylem çağrılır; drawer'ı kapatmalı.
  scope.emptyAction?.();
  expect(onClose).toHaveBeenCalledOnce();
});
it("parmak izi ve salt okunur erişim sorguları yerel hata sınırındadır", () => {
  renderToStaticMarkup(<EmployeeDetails employee={employee} onClose={() => {}} />);
  expect(scope.boundaries).toContain("Parmak izi");
  expect(scope.boundaries).toContain("Erişim yetkileri");
  expect(EmployeeActivityBoundary).toBeDefined();
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => scope.isAdmin, role: "hr", loading: false }) }));
