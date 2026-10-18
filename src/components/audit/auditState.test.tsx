import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { Id } from '../../../convex/_generated/dataModel';
import { auditDateRange } from '../../../convex/lib/auditLogQuery';
import { auditArgs, auditRangeError, clearAuditFilters } from './auditState';
import { auditFieldDisplayValue } from './auditLabels';
import { AuditChangeDetail } from './AuditChangeDetail';
import AuditLog from '@/pages/AuditLog';

const mocks = vi.hoisted(() => ({ query: vi.fn(), paginated: vi.fn() }));
vi.mock('@/components/auth/AuthProvider', () => ({ useAuth: () => ({ profile: { role: 'project_user' } }) }));
vi.mock('convex/react', () => ({ useQuery: mocks.query, usePaginatedQuery: mocks.paginated }));

const project = 'project-a' as Id<'projects'>;
describe('audit filter and display contracts', () => {
  it('clears local filters while retaining project scope and unrelated URL state', () => {
    const params = new URLSearchParams('allProjects=true&project=keep&q=foo&user=system&target=employees&start=2026-10-01&end=2026-10-02&action=delete&other=keep');
    expect(clearAuditFilters(params).toString()).toBe('allProjects=true&project=keep&other=keep');
    expect(params.get('user')).toBe('system');
  });
  it('sends the system discriminator without a fabricated user ID', () => {
    const args = auditArgs(new URLSearchParams('user=system'), project, false);
    expect(args.actor).toBe('system');
    expect(args).not.toHaveProperty('userId');
    expect(args.projectId).toBe(project);
  });
  it('keeps historical actor identity and excludes project in global scope', () => {
    const args = auditArgs(new URLSearchParams('user=historical&action=update&q=ad'), project, true);
    expect(args.userId).toBe('historical');
    expect(args.actor).toBeUndefined();
    expect(args.projectId).toBeUndefined();
    expect(args.action).toBe('update');
    expect(args.search).toBe('ad');
  });
  it('validates reversed and impossible dates without converting them into zero results', () => {
    expect(auditRangeError('2026-10-18', '2026-10-17')).toBe('Başlangıç tarihi bitiş tarihinden sonra olamaz.');
    expect(auditRangeError('2026-02-30')).toBe('Geçerli bir tarih girin.');
    expect(auditRangeError(undefined, '2026-10-17')).toBeUndefined();
  });
  it('includes the full Istanbul day at both boundaries', () => {
    const range = auditDateRange('2026-10-17', '2026-10-17');
    expect(new Date(range.startTimestamp).toISOString()).toBe('2026-10-16T21:00:00.000Z');
    expect(new Date(range.endTimestamp).toISOString()).toBe('2026-10-17T20:59:59.999Z');
  });
  it('distinguishes missing snapshots from false/zero and translates known values only', () => {
    expect(auditFieldDisplayValue('cascade.fingerprints', 0)).toBe('0');
    expect(auditFieldDisplayValue('isHalfDay', false)).toBe('Hayır');
    expect(auditFieldDisplayValue('old', undefined)).toBe('Kaydedilmedi');
    expect(auditFieldDisplayValue('consentType', 'biometric_face')).toBe('Yüz biyometrisi');
    expect(auditFieldDisplayValue('custom', 'biometric_face')).toBe('biometric_face');
    expect(auditFieldDisplayValue('grantedAt', '2026-10-17T07:00:00Z')).toContain('10:00:00');
  });
  it('preserves legacy detail props and masks both diff and technical JSON', () => {
    const html = renderToStaticMarkup(<AuditChangeDetail targetId="full-target-id" targetTable="employees" newValue={{ tcNo: '12345678901', password: 'secret-value' }} />);
    expect(html).toContain('full-target-id');
    expect(html).toContain('Önce');
    expect(html).toContain('Sonra');
    expect(html).toContain('Kaydedilmedi');
    expect(html).not.toContain('12345678901');
    expect(html).not.toContain('secret-value');
  });
  it('does not mount any audit query for project_user', () => {
    const html = renderToStaticMarkup(<MemoryRouter><AuditLog /></MemoryRouter>);
    expect(html).toContain('Denetim kaydını görüntüleme yetkiniz yok.');
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.paginated).not.toHaveBeenCalled();
  });
});
