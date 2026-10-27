// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import schema from './schema';
import { api, internal } from './_generated/api';
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

describe('shift definition colors (removed)', () => {
  it('ignores a legacy client color on create and update; migration clears stored colors', async () => {
    const f = await fixture();
    const shiftId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: 'Eski istemci', startTime: '08:00', endTime: '17:00', color: 'teal' });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).not.toHaveProperty('color');
    await f.caller.mutation(api.shifts.update, { shiftId, color: 'violet' });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).not.toHaveProperty('color');
    await f.t.run(ctx => ctx.db.patch(f.shiftId, { color: 'blue' }));
    expect(await f.t.mutation(internal.migrations.clearShiftColors, {})).toEqual({ cleared: 1, isDone: true });
    expect(await f.t.run(ctx => ctx.db.get(f.shiftId))).not.toHaveProperty('color');
  });
  it('updates name and activity of a flexible definition in place and keeps its times tied to the window', async () => {
    const f = await fixture();
    const flexible = { requiredNetMinutes: 480, checkInStart: '05:00', checkInEnd: '22:00', checkOutStart: '05:00', checkOutEnd: '14:00', checkOutEndDayOffset: 1 as const, maxSpanMinutes: 960, breakMode: 'duration' as const, breakMinutes: 60 };
    const shiftId = await f.t.run(ctx => ctx.db.insert('shifts', { projectId: f.projectId, name: 'Esnek', startTime: '05:00', endTime: '22:00', scheduleType: 'flexible', flexible, createdAt: 'original', updatedAt: 'original' }));
    await f.caller.mutation(api.shifts.update, { shiftId, name: 'Esnek A', isActive: false });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).toMatchObject({ name: 'Esnek A', isActive: false, flexible });
    // Esnekte saat penceresi türetilir; ham saat isteği hesap değişikliği sayılmaz, sürüm açmaz.
    await f.caller.mutation(api.shifts.update, { shiftId, startTime: '06:00' });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).toMatchObject({ startTime: '05:00' });
    expect(await f.t.run(ctx => ctx.db.query('shiftVersions').collect())).toHaveLength(0);
    await expect(f.caller.mutation(api.shifts.update, { shiftId, scheduleType: 'fixed' })).rejects.toThrow('yeni tanım');
  });
});

describe('fixed shift advanced rules API', () => {
  const rules = {
    validWindow: { checkInStart: '08:00', checkInEnd: '10:00', checkOutStart: '16:00', checkOutEnd: '18:00', checkOutEndDayOffset: 0 as const },
    absentAfterLateMinutes: 30, minWorkMinutes: 360, missingCheckInLateMinutes: 20, holidayWorkRequired: true,
  };
  it('creates all rules, preserves omitted values for old clients and explicitly clears each rule', async () => {
    const f = await fixture();
    const shiftId = await f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: 'Kurallı', startTime: '09:00', endTime: '17:00', ...rules });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).toMatchObject(rules);
    await f.caller.mutation(api.shifts.update, { shiftId, name: 'Eski web' });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).toMatchObject(rules);
    await f.caller.mutation(api.shifts.update, { shiftId, minWorkMinutes: 0, holidayWorkRequired: false });
    expect(await f.t.run(ctx => ctx.db.get(shiftId))).toMatchObject({ minWorkMinutes: 0, holidayWorkRequired: false });
    await f.caller.mutation(api.shifts.update, { shiftId, validWindow: null, absentAfterLateMinutes: null, minWorkMinutes: null, missingCheckInLateMinutes: null, holidayWorkRequired: null });
    const cleared = await f.t.run(ctx => ctx.db.get(shiftId));
    for (const key of Object.keys(rules)) expect(cleared).not.toHaveProperty(key);
  });
  it('revalidates the retained window when updating shift times and refuses invalid values', async () => {
    const f = await fixture();
    await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, ...rules });
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, startTime: '11:00' })).rejects.toThrow('Giriş penceresi');
    await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, minWorkMinutes: 1441 })).rejects.toThrow('0–1440');
    await expect(f.caller.mutation(api.shifts.create, { projectId: f.projectId, name: 'Hatalı', startTime: '09:00', endTime: '17:00', validWindow: { ...rules.validWindow, checkOutEnd: '25:00' } })).rejects.toThrow('HH:MM');
    expect(await f.t.run(ctx => ctx.db.get(f.shiftId))).toMatchObject({ startTime: '09:00', ...rules });
  });
  it('rejects clock-bound rules in both flexible create and update mutations', async () => {
    const f = await fixture();
    const flexible = { requiredNetMinutes: 480, checkInStart: '05:00', checkInEnd: '22:00', checkOutStart: '05:00', checkOutEnd: '14:00', checkOutEndDayOffset: 1 as const, maxSpanMinutes: 960, breakMode: 'duration' as const, breakMinutes: 60 };
    const args = { projectId: f.projectId, name: 'Esnek', startTime: '05:00', endTime: '22:00', scheduleType: 'flexible' as const, flexible };
    const shiftId = await f.caller.mutation(api.shifts.create, args);
    for (const patch of [{ validWindow: rules.validWindow }, { absentAfterLateMinutes: 0 }, { missingCheckInLateMinutes: 0 }]) {
      await expect(f.caller.mutation(api.shifts.create, { ...args, ...patch })).rejects.toThrow('esnek vardiyada kullanılamaz');
      await expect(f.caller.mutation(api.shifts.update, { shiftId, ...patch })).rejects.toThrow('esnek vardiyada kullanılamaz');
    }
    const withDayRules = await f.caller.mutation(api.shifts.create, { ...args, minWorkMinutes: 360, holidayWorkRequired: true });
    expect(await f.t.run(ctx => ctx.db.get(withDayRules))).toMatchObject({ scheduleType: 'flexible', minWorkMinutes: 360, holidayWorkRequired: true });
  });
});


it('allows cosmetic changes to malformed historic shift definitions but validates calculation changes', async () => {
  const f = await fixture();
  await f.t.run(ctx => ctx.db.patch(f.shiftId, { minWorkMinutes: -1 }));
  await f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, name: 'Yeni ad', isActive: false });
  expect(await f.t.run(ctx => ctx.db.get(f.shiftId))).toMatchObject({ name: 'Yeni ad', isActive: false, minWorkMinutes: -1 });
  await expect(f.caller.mutation(api.shifts.update, { shiftId: f.shiftId, startTime: '08:00' })).rejects.toThrow();
});
