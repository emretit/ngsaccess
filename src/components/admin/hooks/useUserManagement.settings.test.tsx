import { useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { useUserManagement } from './useUserManagement';
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { role: 'super_admin' } }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ projectId: 'active-project' }) }));
vi.mock('convex/react', () => ({ useQuery: () => [], useMutation: () => vi.fn(), useAction: () => vi.fn() }));
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
