import { PROJECT_ROLES } from "../../../../convex/lib/roleCatalog";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useUserManagement } from './useUserManagement';
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { role: 'super_admin' } }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ projectId: 'active-project' }) }));
const state = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('convex/react', () => ({ useQuery: () => [], useMutation: () => vi.fn(), useAction: () => state.send }));
vi.mock('@/lib/notify', () => ({ notify: { error: vi.fn(), success: vi.fn() }, errorMessage: () => 'Hata' }));
describe('13-O3 invitation default', () => {
  it('starts a new invitation at the active project without marking the baseline dirty', () => {
    let snapshot: ReturnType<typeof useUserManagement> | undefined;
    function Harness() {
      const [step, setStep] = useState(0);
      const management = useUserManagement();
      if (step === 0) { management.resetForm(); setStep(1); }
      else snapshot = management;
      return null;
    }
    renderToStaticMarkup(<Harness />);
    expect(snapshot?.formData.projectId).toBe('active-project');
    expect(snapshot?.formData).toEqual(snapshot?.baseline);
  });
});

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true, role: "super_admin", loading: false }) }));

it.each(PROJECT_ROLES)("sends %s as the project invitation role", async role => {
  state.send.mockReset().mockResolvedValue({ success: true });
  let snapshot: ReturnType<typeof useUserManagement> | undefined;
  function Harness() {
    const [step, setStep] = useState(0);
    const management = useUserManagement();
    if (step === 0) {
      management.setFormData({ email: "ada@example.com", role, projectId: "active-project" as Id<"projects">, projectIds: [] });
      setStep(1);
    } else snapshot = management;
    return null;
  }
  renderToStaticMarkup(<Harness />);
  expect(await snapshot?.handleSaveUser()).toBe(true);
  expect(state.send).toHaveBeenCalledWith({ email: "ada@example.com", role, projectId: "active-project" });
});
