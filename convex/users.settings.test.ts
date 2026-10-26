import { describe, expect, it, vi } from 'vitest';
import type { Doc, Id } from './_generated/dataModel';
import type { QueryCtx } from './_generated/server';
import { adminList } from './users';
const state = vi.hoisted(() => ({ allowed: ['p1'], rows: [] as Record<string, unknown>[], pagination: vi.fn() }));
vi.mock('./lib/customFunctions', () => {
  const register = (config: unknown) => config;
  return { authedQuery: register, superAdminQuery: register, superAdminMutation: register, optionalAuthQuery: register, authedMutation: register };
});
vi.mock('./lib/permissions', async importOriginal => ({ ...await importOriginal<typeof import('./lib/permissions')>(), getProjectIdsWithPermission: async () => state.allowed }));
vi.mock('convex-helpers/server/stream', () => ({ stream: () => ({ query: () => ({ order: () => ({ filterWith: (predicate: (row: Record<string, unknown>) => Promise<boolean>) => ({ paginate: async (options: { numItems: number; cursor: string | null }) => {
  state.pagination(options);
  const rows = [];
  for (const row of state.rows) if (await predicate(row)) rows.push(row);
  const offset = Number(options.cursor ?? 0);
  return { page: rows.slice(offset, offset + options.numItems), isDone: rows.length <= offset + options.numItems, continueCursor: String(offset + options.numItems) };
} }) }) }) }) }));
const p1 = 'p1' as Id<'projects'>;
const p2 = 'p2' as Id<'projects'>;
const callerId = 'caller' as Id<'users'>;
const users = ['Ada', 'Aday', 'Dışarı'].map((name, index) => ({ _id: `u${index}`, _creationTime: 0, fullName: name, email: `${index}@example.com`, role: 'project_user', verified: true }));
const memberships = [{ userId: 'u0', projectId: p1 }, { userId: 'u0', projectId: p2 }, { userId: 'u1', projectId: p1 }, { userId: 'u2', projectId: p2 }];
function fixture() {
  state.rows = users;
  state.pagination.mockClear();
  const db = {
    query: () => {
      let requested: unknown;
      type Eq = { eq: (field: string, value: unknown) => Eq };
      const builder: Eq = { eq: (_field, value) => { requested ??= value; return builder; } };
      return { withIndex: (_: string, apply: (q: Eq) => unknown) => {
        apply(builder);
        // authAccounts lookup (canResetPassword) finds no password account in this fixture.
        return { collect: async () => memberships.filter(row => row.userId === requested), unique: async () => null };
      } };
    },
    get: async (id: string) => ({ _id: id, name: id === p1 ? 'Merkez' : 'Gizli proje', isActive: true }),
  };
  return { db, user: { _id: callerId, role: 'project_admin' } as Doc<'users'> } as unknown as QueryCtx;
}
async function invoke(ctx: QueryCtx, args: object): Promise<{ page: { displayName: string; projects: { name: string }[] }[]; isDone: boolean; continueCursor: string }> {
  return (adminList as unknown as { handler: (ctx: QueryCtx, args: object) => Promise<ReturnType<typeof invoke> extends Promise<infer T> ? T : never> }).handler(ctx, args);
}
describe('13-D9 project administrator directory pagination', () => {
  it('filters before paging and exposes only the shared project names', async () => {
    const ctx = fixture();
    const args = { search: 'ada', role: 'viewer', paginationOpts: { numItems: 1, cursor: null } };
    const first = await invoke(ctx, args);
    expect(first.page.map(row => row.displayName)).toEqual(['Ada']);
    expect(first.page[0].projects).toEqual([{ _id: p1, name: 'Merkez', isActive: true, role: 'viewer' }]);
    expect(first.isDone).toBe(false);
    const next = await invoke(ctx, { ...args, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect(next.page.map(row => row.displayName)).toEqual(['Aday']);
    expect(next.isDone).toBe(true);
    expect(state.pagination).toHaveBeenCalledWith(expect.objectContaining({ numItems: 1, maximumRowsRead: 500 }));
  });
  it('excludes unrelated users and rejects a project filter outside the caller scope', async () => {
    const ctx = fixture();
    expect((await invoke(ctx, { paginationOpts: { numItems: 10, cursor: null } })).page).toHaveLength(2);
    await expect(invoke(ctx, { project: p2, paginationOpts: { numItems: 10, cursor: null } })).rejects.toThrow();
  });
});
