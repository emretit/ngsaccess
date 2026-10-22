import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Id } from './_generated/dataModel';
import type { MutationCtx } from './_generated/server';
import { getVisitorNotice, setVisitorNotice } from './privacyRetention';
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
  return { ctx: { user: { _id: 'admin' }, db: { patch, insert } } as unknown as MutationCtx, patch, insert };
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
