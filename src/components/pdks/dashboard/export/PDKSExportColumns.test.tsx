import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PDKSExportColumns } from './PDKSExportColumns';
import { defaultPDKSPreferences } from '@/lib/pdksExportColumns';
import type { PDKSExportRecord } from '@/utils/pdksExport';
const record: PDKSExportRecord = { id: 'r', employeeId: 'e', name: 'Kişi', department: 'Üretim', firstEntry: '08:00', lastExit: '17:00', totalHours: '8 sa', overtime: '0 sa', leaveType: '—', status: 'present' };
describe('PDKS export column controls', () => {
  it('previews only five records in the actual selected order and offers keyboard buttons', () => {
    const preferences = { ...defaultPDKSPreferences(), orderedColumnKeys: ['department', 'name'] };
    const html = renderToStaticMarkup(<PDKSExportColumns canSeePay={false} records={Array.from({ length: 6 }, (_, i) => ({ ...record, id: String(i), name: `Kişi-${i}` }))} preferences={preferences} onChange={() => {}} />);
    expect(html).toContain('Kişi-4'); expect(html).not.toContain('Kişi-5');
    expect(html.indexOf('>Departman</th>')).toBeLessThan(html.indexOf('>Çalışan</th>'));
    expect(html).not.toContain('>Kart no</th>');
    expect(html).toContain('aria-label="Çalışan yukarı"'); expect(html).toContain('aria-label="Departman aşağı"');
    expect(html).toContain('Varsayılana dön'); expect(html).toContain('En az bir kolon');
  });
  it('disables the last checkbox, and shows CSV delimiter options only for CSV', () => {
    const preferences = { ...defaultPDKSPreferences(), orderedColumnKeys: ['name'] };
    const props = { canSeePay: false, records: [record], preferences, onChange: () => {} };
    const html = renderToStaticMarkup(<PDKSExportColumns {...props} />);
    expect(html).toMatch(/<button[^>]*role="checkbox"[^>]*disabled=""/);
    expect(html).not.toContain('CSV ayracı');
    const csv = renderToStaticMarkup(<PDKSExportColumns {...props} preferences={{ ...preferences, format: 'CSV', delimiter: ';' }} />);
    expect(csv).toContain('CSV ayracı'); expect(csv).toContain('TAB (sekme)'); expect(csv).toContain('value=";" selected=""');
  });
});
