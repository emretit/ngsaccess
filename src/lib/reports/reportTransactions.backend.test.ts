import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgs } from 'convex/server';
import type { api } from '../../../convex/_generated/api';
import type { Doc, Id } from '../../../convex/_generated/dataModel';
import type { QueryCtx } from '../../../convex/_generated/server';
import { listReportTransactions } from '../../../convex/cardReadings';
import type { TransactionPage } from './transactions';
vi.mock('../../../convex/lib/customFunctions', () => {
  const pass = (config: unknown) => config;
  return { authedMutation: pass, authedQuery: pass, employeeAuthedQuery: pass, employeeAuthedMutation: pass };
});
vi.mock('../../../convex/lib/auth', () => ({ getProjectIdsForUser: async () => ['project'] }));
const projectId = 'project' as Id<'projects'>;
const employeeId = 'employee' as Id<'employees'>;
const departmentId = 'department' as Id<'departments'>;
type Row = Record<string, unknown>;
function fixture() {
  const rows: Doc<'cardReadings'>[] = Array.from({ length: 101 }, (_, i) => ({
    _id: `reading-${i}` as Id<'cardReadings'>, _creationTime: i, projectId, cardNo: '123',
    accessTime: `2026-10-19T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
    employeeId: i === 0 ? employeeId : 'other-employee' as Id<'employees'>,
    rawData: JSON.stringify({ source: i === 0 ? 'mobile' : 'card' }), accessStatus: 'izin_verildi',
  }));
  const employee: Row = { _id: employeeId, _creationTime: 0, projectId, departmentId, firstName: 'Ayşe', lastName: 'Test' };
  const department: Row = { _id: departmentId, _creationTime: 0, projectId, name: 'Üretim' };
  const tables: Record<string, Row[]> = { cardReadings: rows, employees: [employee, { ...employee, _id: 'other-employee', departmentId: 'other-department' }], departments: [department] };
  const query = (table: string) => {
    let selected = [...(tables[table] ?? [])];
    let sort = '_creationTime';
    const range = {
      eq: (field: string, value: unknown) => { selected = selected.filter(row => row[field] === value); return range; },
      gt: () => range, lt: () => range, gte: () => range, lte: () => range,
    };
    const chain = {
      withIndex: (name: string, apply: (builder: typeof range) => unknown) => { sort = name.endsWith('_time') ? 'accessTime' : '_creationTime'; apply(range); return chain; },
      order: (direction: string) => { selected.sort((a, b) => String(a[sort]).localeCompare(String(b[sort]), undefined, { numeric: true }) * (direction === 'desc' ? -1 : 1)); return chain; },
      [Symbol.asyncIterator]: async function* () { yield* selected; },
      collect: async () => selected, first: async () => selected[0] ?? null, take: async (n: number) => selected.slice(0, n),
      paginate: async (options: { numItems: number }) => ({ page: selected.slice(0, options.numItems), isDone: selected.length <= options.numItems, continueCursor: String(options.numItems) }),
    };
    return chain;
  };
  const db = { query, get: async (id: string) => Object.values(tables).flat().find(row => row._id === id) ?? null };
  return { ctx: { db } as unknown as QueryCtx, rows, employee, department };
}
type ReportArgs = FunctionArgs<typeof api.cardReadings.listReportTransactions>;
function invoke(ctx: QueryCtx, args: ReportArgs) {
  return (listReportTransactions as unknown as { handler: (ctx: QueryCtx, args: ReportArgs) => Promise<TransactionPage> }).handler(ctx, args);
}
const args = { projectId, paginationOpts: { numItems: 50, cursor: null } };
describe('report filters before pagination', () => {
  it('finds a department match beyond the former first 50 candidates in the first call', async () => {
    const f = fixture();
    const result = await invoke(f.ctx, { ...args, departmentId });
    expect(result.page.map(row => row._id)).toEqual(['reading-0']);
    expect(result.isDone).toBe(true);
  });
  it('combines person, department and mobile sources before pagination', async () => {
    const f = fixture();
    const result = await invoke(f.ctx, { ...args, employeeId, departmentId, sources: ['mobile', 'qr'] });
    expect(result.page.map(row => row._id)).toEqual(['reading-0']);
  });
  it('fills a mobile page after scanning past a page of unrelated sources', async () => {
    const f = fixture();
    const result = await invoke(f.ctx, { ...args, sources: ['mobile', 'qr'] });
    expect(result.page.map(row => row._id)).toEqual(['reading-0']);
  });
  it('honors the requested page size for mobile sources instead of returning 1,000 rows', async () => {
    const f = fixture();
    for (const row of f.rows) row.rawData = JSON.stringify({ source: 'mobile' });
    const result = await invoke(f.ctx, { ...args, sources: ['mobile'] });
    expect(result.page).toHaveLength(50);
    expect(result.isDone).toBe(false);
  });
  it('does not count biometric rows toward the requested result page', async () => {
    const f = fixture();
    for (const row of f.rows.slice(1)) row.hikCurrentVerifyMode = 'face';
    const result = await invoke(f.ctx, args);
    expect(result.page.map(row => row._id)).toEqual(['reading-0']);
    expect(result.hiddenBiometricCount).toBe(100);
  });
  it('rejects departments and employees from another project', async () => {
    const f = fixture(); f.department.projectId = 'foreign';
    await expect(invoke(f.ctx, { ...args, departmentId })).rejects.toThrow('Departman seçili projede bulunamadı');
    f.employee.projectId = 'foreign';
    await expect(invoke(f.ctx, { ...args, employeeId })).rejects.toThrow('Kişi seçili projede bulunamadı');
  });
  it('rejects an inaccessible project before reading data', async () => {
    await expect(invoke(fixture().ctx, { ...args, projectId: 'foreign' as Id<'projects'> })).rejects.toThrow('Bu projeye erişim yetkiniz yok');
  });
});

it('R3B-D3: unknown is visible and filterable while only biometric rows increase the hidden count', async () => {
  const f = fixture();
  for (const row of f.rows.slice(1)) row.hikCurrentVerifyMode = 'face';
  const unknown = f.rows[0];
  if (!unknown) throw new Error('Missing fixture');
  unknown.rawData = undefined;
  unknown.hikCurrentVerifyMode = 'unknown';
  unknown.cardNo = '';
  const result = await invoke(f.ctx, { ...args, sources: ['unknown'] });
  expect(result.page).toHaveLength(1);
  expect(result.page[0]).toMatchObject({ source: 'unknown', sourceLabel: 'Belirsiz' });
  expect(result.hiddenBiometricCount).toBe(100);
});
