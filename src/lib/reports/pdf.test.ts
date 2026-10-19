import { afterEach, expect, it, vi } from 'vitest';
import { exportReport } from './export';
import { getReport } from './registry';
import { flattenDailyRows } from './rows';
import { dailyCell, dailySource } from './testFixtures';

const pdf = vi.hoisted(() => ({ addPage: vi.fn(), addImage: vi.fn(), save: vi.fn() }));
vi.mock('jspdf', () => ({ jsPDF: vi.fn(function () { return pdf; }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it('wraps all 24 daily punches and continues long cells across PDF pages', async () => {
  const definition = getReport('kayitlar', 'okutma-karti');
  if (!definition) throw new Error('Missing time card');
  const cell = dailyCell();
  if (!cell.detail) throw new Error('Missing detail');
  cell.detail.punches = Array.from({ length: 24 }, (_, index) => ({ time: `08:${String(index).padStart(2, '0')}`, direction: 'entry' }));
  const rows = flattenDailyRows([dailySource([cell])]);
  const drawn: string[] = [];
  const context = {
    measureText: (text: string) => ({ width: text.length * 20 }),
    fillText: (text: string) => drawn.push(text),
    fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  };
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => context, toDataURL: () => 'data:image/png;base64,AA==' }) });
  await exportReport('pdf', definition, rows, { from: cell.date, to: cell.date, columns: definition.columns });
  const content = drawn.join('');
  expect(content).toContain('19.10.2026 – 19.10.2026');
  expect(content).not.toContain('2026-10-19 – 2026-10-19');
  for (const punch of cell.detail.punches) expect(content).toContain(punch.time);
  expect(pdf.addPage).toHaveBeenCalled();
  expect(pdf.save).toHaveBeenCalledWith('rapor-okutma-karti-2026-10-19_2026-10-19.pdf');
});
