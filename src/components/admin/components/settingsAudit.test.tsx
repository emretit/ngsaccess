import React, { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserTable } from "./UserTable";
import { AdminSelect } from "./AdminListParts";
import { FilterBar } from "@/components/shared/FilterBar";
import { AdminUsersContent } from "../AdminUsersPanel";
import type { User } from "../types/user-types";

const state = vi.hoisted(() => ({ role: "project_admin", query: vi.fn() }));
vi.mock("@/components/auth/AuthProvider", () => ({ useAuth: () => ({ profile: { role: state.role } }) }));
vi.mock("convex/react", () => ({ useQuery: (...args: unknown[]) => state.query(...args), useMutation: () => vi.fn(), useAction: () => vi.fn() }));
vi.mock("../hooks/useAdminPrimaryAction", () => ({ useAdminPrimaryAction: () => false }));
vi.mock("../hooks/useUserManagement", () => ({ useUserManagement: () => ({ projects: [], resetForm: vi.fn() }) }));

function findElement<P>(node: React.ReactNode, component: unknown): React.ReactElement<P> | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement<{ children?: React.ReactNode }>(child)) continue;
    if (child.type === component) return child as React.ReactElement<P>;
    const result = findElement<P>(child.props.children, component);
    if (result) return result;
  }
}

describe("settings user directory", () => {
  it("O4 displays an email once in each responsive layout and lists real project names", () => {
    const user = { _id: 'u', displayName: 'u@example.com', email: 'u@example.com', role: 'viewer', projects: [{ _id: 'p', name: 'Merkez', isActive: true, role: 'viewer' }], isSelf: false, pendingSetup: false, disabledAt: undefined, accessExpiresAt: undefined, accessExpired: false, setupExpiresAt: undefined } as User;
    const html = renderToStaticMarkup(<UserTable users={[user]} onEditUser={vi.fn()} onDeleteUser={vi.fn()} />);
    expect(html.match(/>u@example.com</g)).toHaveLength(2);
    expect(html.match(/Merkez/g)).toHaveLength(2);
    expect(html).not.toContain('Yetkili proje kapsamı');
  });
  it.each(["project_admin", "super_admin"])("D8 preserves in-flight search text after a role change for %s", role => {
    state.role = role;
    state.query.mockReturnValue({ page: [], isDone: true });
    let search = '';
    function Harness() {
      const [step, setStep] = useState(0);
      const tree = AdminUsersContent();
      const bar = findElement<React.ComponentProps<typeof FilterBar>>(tree, FilterBar);
      const select = findElement<React.ComponentProps<typeof AdminSelect>>(tree, AdminSelect);
      if (!bar || !select) throw new Error('Missing filters');
      if (step === 0) { bar.props.onSearchChange('yeni arama'); setStep(1); }
      else if (step === 1) { select.props.onChange('viewer'); setStep(2); }
      else search = bar.props.search;
      return null;
    }
    renderToStaticMarkup(<Harness />);
    expect(search).toBe('yeni arama');
    expect(state.query.mock.calls.some(([, args]) => args && args !== 'skip' && 'paginationOpts' in args)).toBe(true);
  });
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "admin", loading: false }) }));
