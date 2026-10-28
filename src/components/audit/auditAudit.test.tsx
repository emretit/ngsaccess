import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import AuditLog from '@/pages/AuditLog';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Id } from '../../../convex/_generated/dataModel';
import { AuditFilters } from './AuditFilters';
import { AuditCoverage } from './AuditCoverage';
import { AuditTable } from './AuditTable';
import { AuditDetailPanel } from './AuditDetailPanel';
import { AuditResultsContent } from './AuditResultsContent';
import { auditFieldDisplayValue } from './auditLabels';
import { timestampFormat, type AuditRow } from './auditState';
import type { useAuditUrlState } from './useAuditUrlState';

vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { role: 'super_admin' } }) }));
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({ role: 'super_admin', can: () => true, loading: false }) }));
vi.mock('@/hooks/useActiveProjectScope', () => ({ useActiveProjectScope: () => ({ projectId: 'p', activeProject: { name: 'Proje' }, loading: false }) }));
vi.mock('convex/react', () => ({ useQuery: () => ({ actors: [{ userId: 'author', label: 'author@example.com', status: 'active' }], includesSystem: false }) }));
vi.mock('@/components/ui/select', () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Select: Part, SelectContent: Part, SelectTrigger: Part, SelectValue: () => null, SelectItem: Part };
});
vi.mock('@/components/ui/sheet', () => {
  const Part = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return { Sheet: Part, SheetContent: Part, SheetHeader: Part, SheetTitle: Part, SheetDescription: Part };
});
const state = (params: string): ReturnType<typeof useAuditUrlState> => ({ params: new URLSearchParams(params), search: '', setSearch: vi.fn(), update: vi.fn(), clear: vi.fn(), changingScope: false });
const row: AuditRow = {
 _id: 'event' as Id<'auditLog'>, _creationTime: 1, timestamp: Date.parse('2026-10-19T13:19:03Z'),
 action: 'create', userId: 'author' as Id<'users'>, userName: 'author@example.com', targetTable: 'projectPrivacySettings', targetId: 'p', projectName: 'Proje', newValue: { biometricEnabled: false },
};

describe('denetim kaydı audit düzeltmeleri', () => {
 it('liste ve ayrıntıda tam aktör e-postasını ve Türkçe hedefi gösterir', () => {
  const table = renderToStaticMarkup(<AuditTable rows={[row]} onSelect={vi.fn()} />);
  const panel = renderToStaticMarkup(<AuditDetailPanel row={row} onClose={vi.fn()} returnFocus={{ current: null }} />);
  for (const html of [table, panel]) {
   expect(html).toContain('author@example.com');
   expect(html).toContain('Proje gizlilik ayarları');
   expect(html).not.toContain('projectPrivacySettings');
   expect(html).toContain('19.10.2026 16:19:03');
  }
  expect(table).not.toContain('hidden truncate px-3 lg:table-cell');
 });
 it('filtre sözlüğünde eksik hedefleri, yazarı ve tarihin değerini sunar; hatayı filtre satırının dışına taşır', () => {
  const html = renderToStaticMarkup(<AuditFilters state={state('user=author&start=2026-10-20')} args={{}} ready rangeError="Başlangıç tarihi bitiş tarihinden sonra olamaz." />);
  expect(html).toContain('Proje gizlilik ayarları');
  expect(html).toContain('Kart okumaları');
  expect(html).toContain('author@example.com');
  expect(html).toContain('Kayıtları yapan kişi');
  expect(html).not.toContain('Proje üyesi değil');
  expect(html).toContain('aria-label="Başlangıç: 20.10.2026"');
  expect(html).toContain('aria-label="Bitiş: Tarih seçin"');
  expect(html).toContain('aria-describedby="audit-range-error"');
  expect(html).toContain('aria-invalid="true"');
  expect(html).toContain('</div><p id="audit-range-error" role="alert" class="w-full');
  expect(html.match(/Filtreleri temizle/g)).toHaveLength(1);
 });
 it('sonuçlar boşken tekrar eden sayaç, tamamlandı metni ve temizleme düğmesi eklemez', () => {
  const html = renderToStaticMarkup(<AuditResultsContent args={{ actor: 'system' }} rows={[]} more={false} filtered active status="Exhausted" loadMore={vi.fn()} onSelect={vi.fn()} />);
  expect(html).toContain('Filtrelere uygun kayıt yok');
  expect(html).not.toContain('eşleşen kayıt yüklendi');
  expect(html).not.toContain('tüm eşleşmeler yüklendi');
  expect(html).not.toContain('Filtreleri temizle');
 });
 it('geçersiz tarih aralığında tek hata verir, tablo başlığını korur ve sonuç sorgusu açmaz', () => {
  const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/audit-log?start=2026-10-20&end=2026-10-19']}><AuditLog /></MemoryRouter>);
  expect(html.match(/Başlangıç tarihi bitiş tarihinden sonra olamaz\./g)).toHaveLength(1);
  expect(html).toContain('<thead');
  expect(html).toMatch(/<tbody>.*Geçerli bir tarih aralığı seçilince kayıtlar listelenir\./s);
  expect(html).not.toContain('Tarih aralığını düzeltin.');
  expect(html).toContain('Hangi eylemler kaydedilir');
 });
 it('boş ara sayfada devam etmeyi mümkün tutar', () => {
  const html = renderToStaticMarkup(<AuditResultsContent args={{}} rows={[]} more filtered active status="CanLoadMore" loadMore={vi.fn()} onSelect={vi.fn()} />);
  expect(html).toContain('Taranan kayıtlarda eşleşme yok');
  expect(html).toContain('Daha fazla yükle');
  expect(html).not.toContain(' disabled=');
 });
 it('liste, ayrıntı ve değişiklik zamanlarını ortak İstanbul biçiminde gösterir', () => {
  expect(timestampFormat.format(row.timestamp)).toBe('19.10.2026 16:19:03');
  expect(auditFieldDisplayValue('biometricChangedAt', '2026-10-19T13:19:03Z')).toBe('19.10.2026 16:19:03');
  expect(auditFieldDisplayValue('createdAt', row.timestamp)).toBe('19.10.2026 16:19:03');
 });
 it('kayıt kapsamını kapalı açılır listede gerçek işlemlerle açıklar', () => {
  const html = renderToStaticMarkup(<AuditCoverage />);
  expect(html).toContain('<details');
  expect(html).not.toContain('open=');
  expect(html).toContain('Hangi eylemler kaydedilir');
  expect(html.match(/<li>/g)).toHaveLength(6);
  for (const text of ['rızalarının', 'Elle PDKS', 'Tatil ekleme', 'Biyometrik imha', 'otomatik temizliği', 'Diğer yönetim işlemleri']) expect(html).toContain(text);
 });
});
