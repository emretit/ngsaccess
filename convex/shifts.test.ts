// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from './schema';
import { api } from './_generated/api';
const modules = import.meta.glob('./**/*.ts');
async function fixture(role: 'project_admin' | 'project_user' = 'project_admin') {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const projectId = await ctx.db.insert('projects', { name: 'Test' });
    const foreignId = await ctx.db.insert('projects', { name: 'Other' });
    const userId = await ctx.db.insert('users', { role });
    const sessionId = await ctx.db.insert('authSessions', { userId, expirationTime: Date.now() + 86400000 });
    await ctx.db.insert('userProjects', { userId, projectId });
    const employeeId = await ctx.db.insert('employees', { projectId, firstName: 'Ayşe', lastName: 'Test', email: 'test@example.test', cardNumber: 'test' });
    const foreignEmployeeId = await ctx.db.insert('employees', { projectId: foreignId, firstName: 'Other', lastName: 'Test', email: 'other@example.test', cardNumber: 'other' });
    const shiftId = await ctx.db.insert('shifts', { projectId, name: 'Gündüz', startTime: '09:00', endTime: '17:00', createdAt: 'original', updatedAt: 'original' });
    return { projectId, userId, sessionId, employeeId, foreignEmployeeId, shiftId };
  });
  const caller = t.withIdentity({ subject: `${ids.userId}|${ids.sessionId}` });
  const args = { projectId: ids.projectId, employeeIds: [ids.employeeId], startDate: '2025-03-10', endDate: '2025-03-20' };
  const insert = (startDate: string, endDate: string, count = 1) => t.run(async ctx => {
    for (let i = 0; i < count; i++) await ctx.db.insert('shiftAssignments', { employeeId: ids.employeeId, projectId: ids.projectId, shiftId: ids.shiftId, startDate, endDate, weekPattern: ['MON'], createdAt: 'original', updatedAt: 'original' });
  });
  return { t, caller, args, insert, ...ids };
}
describe('shift bulk clear', () => {
  it('deletes, trims either edge, splits and preserves external rows; preview equals mutation and one audit', async () => {
    const f = await fixture();
    for (const [start, end] of [['12','18'], ['01','15'], ['15','28'], ['01','28'], ['01','05']]) await f.insert(`2025-03-${start}`, `2025-03-${end}`);
    const preview = await f.caller.query(api.shifts.previewClearAssignments, f.args);
    expect(preview).toEqual({ deleted: 1, trimmed: 2, split: 1, affectedEmployees: 1, affectsPast: true });
    expect(await f.caller.mutation(api.shifts.clearAssignments, f.args)).toEqual(preview);
    const rows = await f.t.run(ctx => ctx.db.query('shiftAssignments').take(20));
    expect(rows.map(row => [row.startDate, row.endDate]).sort()).toEqual([
      ['2025-03-01','2025-03-05'], ['2025-03-01','2025-03-09'], ['2025-03-01','2025-03-09'], ['2025-03-21','2025-03-28'], ['2025-03-21','2025-03-28'],
    ]);
    expect(rows.every(row => row.weekPattern?.[0] === 'MON' && row.createdAt === 'original')).toBe(true);
    const logs = await f.t.run(ctx => ctx.db.query('auditLog').take(20));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ action: 'delete', targetTable: 'shiftAssignments', projectId: f.projectId, userId: f.userId, newValue: preview });
  });
  it('rejects project_user in both endpoints', async () => {
    const f = await fixture('project_user');
    await expect(f.caller.query(api.shifts.previewClearAssignments, f.args)).rejects.toThrow('yetkiniz yok');
    await expect(f.caller.mutation(api.shifts.clearAssignments, f.args)).rejects.toThrow('yetkiniz yok');
  });
  it('rejects foreign employee and invalid, duplicate, excessive selections or date ranges', async () => {
    const f = await fixture();
    for (const patch of [{ employeeIds: [f.foreignEmployeeId] }, { employeeIds: [f.employeeId, f.employeeId] }, { employeeIds: Array.from({ length: 501 }, () => f.employeeId) }, { startDate: '2025-02-30' }, { endDate: '2026-03-11' }]) {
      await expect(f.caller.query(api.shifts.previewClearAssignments, { ...f.args, ...patch })).rejects.toThrow();
      await expect(f.caller.mutation(api.shifts.clearAssignments, { ...f.args, ...patch })).rejects.toThrow();
    }
  });
  it('revalidates mutation after preview and rejects over 1000 without writes', async () => {
    const f = await fixture();
    expect((await f.caller.query(api.shifts.previewClearAssignments, f.args)).deleted).toBe(0);
    await f.insert('2025-03-12', '2025-03-18', 1001);
    await expect(f.caller.mutation(api.shifts.clearAssignments, f.args)).rejects.toThrow('aralığı daraltın');
    await expect(f.caller.query(api.shifts.previewClearAssignments, f.args)).rejects.toThrow('aralığı daraltın');
    expect(await f.t.run(ctx => ctx.db.query('shiftAssignments').take(1002))).toHaveLength(1001);
    expect(await f.t.run(ctx => ctx.db.query('auditLog').take(1))).toHaveLength(0);
  });
});

describe('shift definition colors', () => {
  it('creates, lists and updates a color; null removes it while omitted color preserves it', async () => {
    const f = await fixture();
    const shiftId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: 'Renkli', startTime: '08:00', endTime: '17:00', color: 'teal' });
    expect((await f.caller.query(api.shifts.list, { projectId: f.projectId })).find(row => row._id === shiftId)?.color).toBe('teal');
    await f.caller.mutation(api.shifts.update, { shiftId, name: 'Yeni ad' });
    expect((await f.t.run(ctx => ctx.db.get(shiftId)))?.color).toBe('teal');
    await f.caller.mutation(api.shifts.update, { shiftId, color: 'violet' });
    expect((await f.t.run(ctx => ctx.db.get(shiftId)))?.color).toBe('violet');
    await f.caller.mutation(api.shifts.update, { shiftId, color: null });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).not.toHaveProperty('color');
  });
  it('rejects unknown color keys at both public mutation validators', async () => {
    const f = await fixture();
    // Simulate an untyped client sending an invalid runtime value.
    // @ts-expect-error Invalid color is intentionally sent to the validator.
    await expect(f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: 'Geçersiz', startTime: '08:00', endTime: '17:00', color: 'red' })).rejects.toThrow();
    // @ts-expect-error Invalid color is intentionally sent to the validator.
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, color: 'red' })).rejects.toThrow();
  });
  it('allows legacy clients to create a definition without color', async () => {
    const f = await fixture();
    const shiftId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: 'Eski istemci', startTime: '08:00', endTime: '17:00' });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).not.toHaveProperty('color');
  });
  it('updates name, color and activity of a flexible definition in place but rejects schedule changes', async () => {
    const f = await fixture();
    const flexible = { requiredNetMinutes: 480, checkInStart: '05:00', checkInEnd: '22:00', checkOutStart: '05:00', checkOutEnd: '14:00', checkOutEndDayOffset: 1 as const, maxSpanMinutes: 960, breakMode: 'duration' as const, breakMinutes: 60 };
    const shiftId = await f.t.run(ctx => ctx.db.insert('shifts', { projectId: f.projectId, name: 'Esnek', startTime: '05:00', endTime: '22:00', scheduleType: 'flexible', flexible, createdAt: 'original', updatedAt: 'original' }));
    await f.caller.mutation(api.shifts.update, { shiftId, name: 'Esnek A', color: 'teal', isActive: false });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).toMatchObject({ name: 'Esnek A', color: 'teal', isActive: false, flexible });
    await expect(f.caller.mutation(api.shifts.update, { shiftId, startTime: '06:00' })).rejects.toThrow(/yeni tanım/);
  });
});
