import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { MutationCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { api } from './_generated/api';
import { checkInWithToken } from './employeeCheckIn';

vi.mock('./lib/customFunctions', () => ({
  employeeAuthedMutation: (definition: { handler: unknown }) => ({ _handler: definition.handler }),
}));

const handler = (checkInWithToken as unknown as {
  _handler: (ctx: MutationCtx, args: FunctionArgs<typeof api.employeeCheckIn.checkInWithToken>) =>
    Promise<FunctionReturnType<typeof api.employeeCheckIn.checkInWithToken>>;
})._handler;

function fixture(overrides: Partial<Doc<'checkInTokens'>> = {}, missingToken = false) {
  let record: Doc<'checkInTokens'> | null = missingToken ? null : {
    _id: 'token-id' as Id<'checkInTokens'>,
    _creationTime: Date.now(),
    employeeId: 'employee-id' as Id<'employees'>,
    token: 'qr-token',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  const employee = {
    firstName: 'Ada', lastName: 'Yılmaz', cardNumber: '123', projectId: 'project-id',
  };
  const get = vi.fn(async () => employee as typeof employee | null);
  const patch = vi.fn(async (_id: unknown, changes: Partial<Doc<'checkInTokens'>>) => {
    if (record) record = { ...record, ...changes };
  });
  const insert = vi.fn(async () => 'reading-id');
  const query = { withIndex: () => query, first: async () => record };
  const ctx = { db: { query: () => query, get, patch, insert } } as unknown as MutationCtx;
  return { ctx, get, patch, insert };
}

describe('QR check-in transaction result contract', () => {
  it.each([
    ['invalid_token', 'Geçersiz veya süresi dolmuş kod', {}, true],
    ['expired_token', 'Kodun süresi doldu', { expiresAt: new Date(0).toISOString() }, false],
    ['employee_not_found', 'Çalışan bulunamadı', {}, false],
  ] as const)('returns stable %s with legacy wording and no writes', async (code, error, overrides, missing) => {
    const f = fixture(overrides, missing);
    f.get.mockResolvedValue(null);
    expect(await handler(f.ctx, { token: 'qr-token' })).toEqual({ success: false, code, error });
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
  });

  it.each([true, false])('replays the original snapshot with locationRecorded=%s after employee deletion', async (withLocation) => {
    const f = fixture();
    const first = await handler(f.ctx, {
      token: 'qr-token', ...(withLocation ? { latitude: 0, longitude: 0 } : {}),
    });
    expect(first).toMatchObject({ success: true, employeeName: 'Ada Yılmaz', locationRecorded: withLocation });
    expect(f.patch).toHaveBeenCalledWith('token-id', {
      usedAt: first.accessTime, employeeName: 'Ada Yılmaz', locationRecorded: withLocation,
    });
    expect(f.insert).toHaveBeenCalledWith('cardReadings', expect.objectContaining({
      accessTime: first.accessTime, employeeName: first.employeeName, employeeId: 'employee-id',
    }));
    f.get.mockResolvedValue(null);
    const replay = await handler(f.ctx, { token: 'qr-token', latitude: 99, longitude: 99 });
    expect(replay).toEqual(first);
    expect(f.get).toHaveBeenCalledOnce();
    expect(f.patch).toHaveBeenCalledOnce();
    expect(f.insert).toHaveBeenCalledOnce();
  });

  it('uses stored snapshots even after expiry and employee rename', async () => {
    const f = fixture({ usedAt: new Date(0).toISOString(), expiresAt: new Date(1).toISOString(),
      employeeName: 'Eski Ad', locationRecorded: true });
    expect(await handler(f.ctx, { token: 'qr-token' })).toEqual({
      success: true, employeeName: 'Eski Ad', accessTime: new Date(0).toISOString(), locationRecorded: true,
    });
    expect(f.get).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
  });

  it('keeps legacy completed tokens successful with unknown snapshot fields', async () => {
    const usedAt = new Date(0).toISOString();
    const f = fixture({ usedAt, expiresAt: usedAt });
    f.get.mockResolvedValue(null);
    expect(await handler(f.ctx, { token: 'qr-token' })).toEqual({
      success: true, employeeName: undefined, accessTime: usedAt, locationRecorded: undefined,
    });
    expect(f.get).not.toHaveBeenCalled();
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
  });
});
