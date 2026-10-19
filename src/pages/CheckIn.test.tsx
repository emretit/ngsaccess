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
  it('uses backend success and location confirmation', () => {
    expect(checkInPresentation({ success: true, employeeName: 'Test', locationRecorded: true })).toEqual({
      status: 'success',
      usedLocation: true,
      record: { name: 'Test', accessTime: undefined },
    });
    expect(checkInPresentation({ success: true, locationRecorded: false })).toMatchObject({
      usedLocation: false,
    });
    expect(checkInPresentation({ success: true })).toMatchObject({ usedLocation: false });
  });
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
