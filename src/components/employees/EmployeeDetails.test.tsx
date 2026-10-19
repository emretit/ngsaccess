import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Employee } from "@/types/employee";
import type { Id } from "../../../convex/_generated/dataModel";
import EmployeeDetails from "./EmployeeDetails";

vi.mock("react-router-dom", () => ({ Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a> }));
vi.mock("@/hooks/useActiveProjectScope", () => ({ useActiveProjectScope: () => ({ isAdmin: false, projectId: "project-a" }) }));
vi.mock("convex/react", () => ({ useQuery: () => [] }));
vi.mock("./EmployeeSyncSection", () => ({ EmployeeSyncSection: () => <div data-testid="sync" /> }));
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

describe("çalışan ayrıntısı", () => {
  it("KVKK rıza kartını seçili çalışan için son geçişlerin üstünde gösterir", () => {
    const html = renderToStaticMarkup(<EmployeeDetails employee={employee} onEdit={() => undefined} onClose={() => undefined} />);
    expect(html).toContain('data-employee-id="employee-a"');
    expect(html.indexOf("Fotoğraf ve veri kayıtları")).toBeGreaterThan(-1);
    expect(html.indexOf('data-testid="consents"')).toBeLessThan(html.indexOf('data-testid="readings"'));
  });

  it("çalışan yokken hiçbir bölüm, rıza kartı dahil, çizmez", () => {
    const html = renderToStaticMarkup(<EmployeeDetails employee={null} onEdit={() => undefined} onClose={() => undefined} />);
    expect(html).toBe("");
  });
});
