import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { getVisitorNotice, setVisitorNotice, getVisitorRetention, setVisitorRetention, previewVisitorRetention } from './privacyRetention';
const mocks = vi.hoisted(() => ({ allowed: ['project'], row: null as Record<string, unknown> | null, audit: vi.fn() }));
vi.mock('./lib/customFunctions', () => ({ authedMutation: (config: unknown) => config, authedQuery: (config: unknown) => config }));
vi.mock('./lib/auth', () => ({ getProjectIdsForUser: async () => mocks.allowed }));
vi.mock('./lib/permissions', () => ({ requirePermission: async (_ctx: unknown, _user: unknown, id: string) => { if (!mocks.allowed.includes(id)) throw new Error('Bu işlem için yetkiniz yok'); } }));
vi.mock('./lib/privacySettings', async importOriginal => ({ ...await importOriginal<typeof import('./lib/privacySettings')>(), getPrivacyRow: async () => mocks.row }));
vi.mock('./lib/audit', () => ({ writeAudit: (...args: unknown[]) => mocks.audit(...args) }));
const projectId = 'project' as Id<'projects'>;
function fixture() {
  const patch = vi.fn();
  const insert = vi.fn();
  const first = vi.fn(async () => mocks.row);
  const query = vi.fn(() => ({ withIndex: () => ({ first }) }));
  return { ctx: { user: { _id: 'admin' }, db: { patch, insert, query } } as unknown as MutationCtx, patch, insert };
}
async function invoke<T>(fn: unknown, ctx: MutationCtx, args: object): Promise<T> {
  return (fn as { handler: (ctx: MutationCtx, args: object) => Promise<T> }).handler(ctx, args);
}
beforeEach(() => { mocks.allowed = ['project']; mocks.row = null; mocks.audit.mockReset(); });
describe('visitor notice admin settings', () => {
  it('reads an empty default and writes the provided approved URL/version with an audit record', async () => {
    const { ctx, insert } = fixture();
    expect(await invoke(getVisitorNotice, ctx, { projectId })).toEqual({ visitorKvkkUrl: '', visitorKvkkVersion: '' });
    await invoke(setVisitorNotice, ctx, { projectId, visitorKvkkUrl: ' https://example.com/notice ', visitorKvkkVersion: ' v2 ' });
    expect(insert).toHaveBeenCalledWith('projectPrivacySettings', expect.objectContaining({ projectId, visitorKvkkUrl: 'https://example.com/notice', visitorKvkkVersion: 'v2' }));
    expect(mocks.audit).toHaveBeenCalledWith(ctx, expect.objectContaining({ targetTable: 'projectPrivacySettings', newValue: { visitorKvkkUrl: 'https://example.com/notice', visitorKvkkVersion: 'v2' } }));
  });
  it('clears only notice fields without replacing other privacy settings', async () => {
    mocks.row = { _id: 'privacy', biometricEnabled: false, aiMaskNames: true, visitorKvkkUrl: 'https://example.com', visitorKvkkVersion: '1' };
    const { ctx, patch, insert } = fixture();
    await invoke(setVisitorNotice, ctx, { projectId, visitorKvkkUrl: '', visitorKvkkVersion: '' });
    expect(patch).toHaveBeenCalledWith('privacy', { visitorKvkkUrl: undefined, visitorKvkkVersion: undefined, updatedAt: expect.any(String) });
    expect(insert).not.toHaveBeenCalled();
  });
  it.each([['javascript:alert(1)', 'v1'], ['https://example.com', ''], ['https://user:password@example.com', 'v1']])('rejects invalid configuration %s', async (visitorKvkkUrl, visitorKvkkVersion) => {
    const { ctx, insert } = fixture();
    await expect(invoke(setVisitorNotice, ctx, { projectId, visitorKvkkUrl, visitorKvkkVersion })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('rejects reads and writes outside the administrator project scope', async () => {
    mocks.allowed = [];
    const { ctx, insert } = fixture();
    await expect(invoke(getVisitorNotice, ctx, { projectId })).rejects.toThrow();
    await expect(invoke(setVisitorNotice, ctx, { projectId, visitorKvkkUrl: '', visitorKvkkVersion: '' })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
});


describe('visitor retention admin settings', () => {
  it('defaults to disabled and audits a setting change', async () => {
    const { ctx, insert } = fixture();
    expect(await invoke(getVisitorRetention, ctx, { projectId })).toEqual({ visitorRetentionDays: null });
    await invoke(setVisitorRetention, ctx, { projectId, days: 90 });
    expect(insert).toHaveBeenCalledWith('projectPrivacySettings', expect.objectContaining({ projectId, visitorRetentionDays: 90 }));
    expect(mocks.audit).toHaveBeenCalledWith(ctx, expect.objectContaining({ oldValue: { visitorRetentionDays: null }, newValue: { visitorRetentionDays: 90 } }));
  });
  it('clears retention without altering the notice or other settings', async () => {
    mocks.row = { _id: 'privacy', visitorRetentionDays: 90, visitorKvkkVersion: 'v2' };
    const { ctx, patch } = fixture();
    await invoke(setVisitorRetention, ctx, { projectId, days: null });
    expect(patch).toHaveBeenCalledWith('privacy', { visitorRetentionDays: undefined, updatedAt: expect.any(String) });
  });
  it.each([29, 3651, 30.5, NaN, Infinity])('rejects invalid days %s without writing', async days => {
    const { ctx, insert, patch } = fixture();
    await expect(invoke(setVisitorRetention, ctx, { projectId, days })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled(); expect(patch).not.toHaveBeenCalled();
  });
  it('requires admin.manage for retention reads, writes and preview', async () => {
    mocks.allowed = [];
    const { ctx, insert } = fixture();
    await expect(invoke(getVisitorRetention, ctx, { projectId })).rejects.toThrow();
    await expect(invoke(setVisitorRetention, ctx, { projectId, days: 90 })).rejects.toThrow();
    await expect(invoke(previewVisitorRetention, ctx, { projectId, days: 90 })).rejects.toThrow();
    expect(insert).not.toHaveBeenCalled();
  });
});

it('bounds visitor preview to 201 reads and labels incomplete counts', async () => {
  const take = vi.fn(async () => Array.from({ length: 201 }, (_, i) => ({ isVisitor: true, isActive: false,
    accessExpiresAt: '2000-01-01T00:00:00Z', visitorStatus: i === 0 ? 'preRegistered' : 'checkedOut' })));
  const query = vi.fn(() => ({ withIndex: () => ({ take }) }));
  const ctx = { user: { _id: 'admin' }, db: { query } } as unknown as MutationCtx;
  expect(await invoke(previewVisitorRetention, ctx, { projectId, days: 90 })).toEqual({ count: 200, capped: true });
  expect(query).toHaveBeenCalledWith('employees');
  expect(take).toHaveBeenCalledWith(201);
});
