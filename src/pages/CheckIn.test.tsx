import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CheckIn, { checkInPresentation } from './CheckIn';

vi.mock('convex/react', () => ({ useMutation: () => vi.fn() }));
describe('CheckIn presentation', () => {
  it('starts pending rather than claiming success before the backend responds', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/check-in?token=test']}>
        <CheckIn />
      </MemoryRouter>,
    );
    expect(html).toContain('Girişiniz kaydediliyor.');
    expect(html).not.toContain('Girişiniz kaydedildi.');
  });
  it('shows neutral used status without personal data', () => {
    expect(checkInPresentation({ success: true, status: 'used', employeeName: 'Private', accessTime: '2026-01-01' })).toEqual({ status: 'used' });
  });
  it('uses backend success and location confirmation', () => {
    expect(checkInPresentation({ success: true, employeeName: 'Test', locationRecorded: true })).toEqual({
      status: 'success',
      usedLocation: true,
      record: { name: 'Test', accessTime: undefined },
    });
    expect(checkInPresentation({ success: true, locationRecorded: false })).toMatchObject({
      usedLocation: false,
    });
    expect(checkInPresentation({ success: true })).toMatchObject({ usedLocation: undefined });
  });
  it.each(['invalid_token', 'expired_token'])(
    'uses %s even when backend wording changes',
    (code) => {
      expect(checkInPresentation({ success: false, code, error: 'Yeni hata metni' }))
        .toEqual({ status: 'error', failure: 'invalid' });
    },
  );
  it.each(['employee_not_found', 'future_code', ''])(
    'keeps %s rejected even if legacy text suggests an invalid token',
    (code) => {
      expect(checkInPresentation({ success: false, code, error: 'Kodun süresi doldu' }))
        .toEqual({ status: 'error', failure: 'rejected' });
    },
  );
  it.each(['Geçersiz veya süresi dolmuş kod', 'Kodun süresi doldu'])(
    'maps %s to invalid presentation without exposing backend text',
    (error) => {
      expect(checkInPresentation({ success: false, error })).toEqual({ status: 'error', failure: 'invalid' });
    },
  );
  it.each(['Çalışan bulunamadı', 'technical details', undefined])('keeps %s generic', (error) => {
    expect(checkInPresentation({ success: false, error })).toEqual({ status: 'error', failure: 'rejected' });
  });
});
