import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../../convex/_generated/dataModel';
import { PdksSettingsPanel } from './PdksSettingsPanel';
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
    expect(html).toContain('href="/pdks-records?plan=1"');
    expect(html).toContain('Vardiya planı');
    expect(html).toContain('Tatil takvimi');
    expect(html).not.toContain('Çalışma günleri');
    expect(html).toContain('min-[1200px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]');
    expect(html).toContain('min-[1200px]:col-span-2');
  });
});
