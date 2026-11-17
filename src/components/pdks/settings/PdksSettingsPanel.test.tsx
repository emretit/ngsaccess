import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../../convex/_generated/dataModel';
import { PdksSettingsPanel } from './PdksSettingsPanel';
import PdksSettings from '@/pages/PdksSettings';
const state = vi.hoisted(() => ({ allowed: true, loading: false, projectId: 'project' as string | null }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ can: () => state.allowed, loading: false }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ projectId: state.projectId, activeProject: { name: 'Merkez' }, loading: state.loading }) }));
beforeEach(() => { state.allowed = true; state.loading = false; state.projectId = 'project'; });
vi.mock('@/components/settings/useSettingsFormsGuard', () => ({ useSettingsFormsGuard: () => ({ reportForm: () => {}, dialog: null }) }));
vi.mock('@/components/settings/sections/components/OvertimeSettingsForm', () => ({ OvertimeSettingsForm: () => <p>Mesai</p> }));
vi.mock('@/components/settings/sections/components/PdksRulesSettings', () => ({ PdksRulesSettings: () => <p>Kurallar</p> }));
vi.mock('@/components/settings/sections/components/HolidayCalendarManager', () => ({ HolidayCalendarManager: () => <p>Tatil takvimi</p> }));
vi.mock('./CheckpointWarnings', () => ({ CheckpointWarnings: () => <p>Uyarılar</p> }));
vi.mock('@/components/shared/QuerySectionBoundary', () => ({ QuerySectionBoundary: ({ children, className }: { children: ReactNode; className: string }) => <div className={className}>{children}</div> }));
describe('PDKS ayarlar kartları', () => {
  it('vardiya planına yönlendirir ve mevcut kart ızgarasında tatil takvimini korur', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PdksSettingsPanel projectId={'project' as Id<'projects'>} /></MemoryRouter>);
    expect(html).toContain('Hafta tatili günleri vardiya planında seçilir.');
    expect(html).toContain('href="/pdks-records/plan"');
    expect(html).toContain('Vardiya planı');
    expect(html).toContain('Tatil takvimi');
    expect(html).not.toContain('Çalışma günleri');
  });
});

it.each(['ready', 'loading', 'denied', 'no-project'])('retains the settings identity and return action in state: %s', status => {
  state.allowed = status !== 'denied';
  state.loading = status === 'loading';
  state.projectId = status === 'no-project' ? null : 'project';
  const html = renderToStaticMarkup(<MemoryRouter><PdksSettings /></MemoryRouter>);
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).not.toMatch(/<main\b/);
  expect(html).toContain('PDKS Ayarları');
  expect(html).toContain('Vardiya planı');
  if (status === 'ready') expect(html).toContain('Tatil takvimi');
  else {
    expect(html).not.toContain('Tatil takvimi');
    expect(html).toContain(status === 'loading' ? 'PDKS ayarları yükleniyor' : status === 'denied' ? 'PDKS ayarlarını görüntüleme yetkiniz yok' : 'Bir proje seçin');
  }
});
