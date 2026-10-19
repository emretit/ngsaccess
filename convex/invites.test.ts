import { describe, expect, it, vi } from 'vitest';
import type { FunctionArgs, FunctionReturnType } from 'convex/server';
import type { ActionCtx, MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import type { api } from './_generated/api';
import { invalidateSessions, modifyAccountCredentials } from '@convex-dev/auth/server';
import { consume, create, list, setupAccountState, resetClaimedAccount, claimSetupAccount } from './invites';
import { limiter } from './lib/rateLimit';

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@convex-dev/auth/server')>();
  return {
    ...actual,
    modifyAccountCredentials: vi.fn(async () => undefined),
    invalidateSessions: vi.fn(async () => undefined),
  };
});
vi.mock('./lib/rateLimit', () => ({ limiter: { limit: vi.fn(async () => undefined) } }));
vi.mock('./lib/customFunctions', () => {
  const register = (definition: { handler: unknown }) => ({ _handler: definition.handler });
  return { superAdminQuery: register };
});

// Use the registered production handler, real getAuthUserId and real verifyUser.
// Only the database and server-provided identity are in-memory fixtures, following
// adminSettingsGuards.test.ts; no live auth, rate-limiter or database calls occur.
const handler = (consume as unknown as {
  _handler: (ctx: MutationCtx, args: FunctionArgs<typeof api.invites.consume>) => Promise<null>;
})._handler;
const userId = 'recipient' as Id<'users'>;
const attackerId = 'inviter' as Id<'users'>;
const sessionId = 'session' as Id<'authSessions'>;
const projectId = 'invited-project' as Id<'projects'>;
const otherProjectId = 'existing-project' as Id<'projects'>;
const args = { token: 'invite-token', email: 'recipient@example.test' };

const setupStateHandler = (setupAccountState as unknown as {
  _handler: (ctx: QueryCtx, args: { token: string }) => Promise<unknown>;
})._handler;
const resetClaimedHandler = (resetClaimedAccount as unknown as {
  _handler: (ctx: MutationCtx, args: { userId: Id<'users'> }) => Promise<null>;
})._handler;
const claimHandler = (claimSetupAccount as unknown as {
  _handler: (ctx: ActionCtx, args: { token: string; password: string }) => Promise<{ flow: 'signUp' | 'signIn' }>;
})._handler;

type IndexBuilder = { eq: (field: string, value: unknown) => IndexBuilder };
type FilterBuilder = {
  field: (name: string) => string;
  eq: (field: string, value: unknown) => { field: string; value: unknown };
};
function makeQuery(records: Record<string, unknown>[]) {
  const criteria: Record<string, unknown> = {};
  let extraCriterion: { field: string; value: unknown } | undefined;
  const indexBuilder: IndexBuilder = { eq: (field, value) => { criteria[field] = value; return indexBuilder; } };
  const rows = () => records
    .filter((row) => Object.entries(criteria).every(([key, value]) => row[key] === value))
    .filter((row) => !extraCriterion || row[extraCriterion.field] === extraCriterion.value);
  const result = {
    withIndex: (_name: string, apply: (q: IndexBuilder) => unknown) => { apply(indexBuilder); return result; },
    filter: (apply: (q: FilterBuilder) => { field: string; value: unknown }) => {
      extraCriterion = apply({ field: (name) => name, eq: (field, value) => ({ field, value }) });
      return result;
    },
    first: async () => rows()[0] ?? null,
    take: async (limit: number) => rows().slice(0, limit),
    collect: async () => rows(),
    async *[Symbol.asyncIterator]() { yield* rows(); },
  };
  return result;
}

function fixture(options: {
  user?: Partial<Doc<'users'>>;
  invite?: Partial<Doc<'invites'>>;
  identity?: Id<'users'> | null;
  memberships?: Id<'projects'>[];
  missingUser?: boolean;
  missingSession?: boolean;
  missingInvite?: boolean;
} = {}) {
  let user: Doc<'users'> = {
    _id: userId, _creationTime: 1, email: args.email, role: 'project_user', verified: true,
    ...options.user,
  };
  let invite: Doc<'invites'> = {
    _id: 'invitation' as Id<'invites'>, _creationTime: 1,
    ...args, projectId, role: 'project_admin', type: 'invite', used: false,
    createdBy: attackerId, createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(), ...options.invite,
  };
  const memberships = (options.memberships ?? []).map((id) => ({ userId, projectId: id }));
  const identity = options.identity === undefined ? userId : options.identity;
  let sessionExists = !options.missingSession;
  const get = vi.fn(async (id: Id<'users'> | Id<'authSessions'>) => {
    if (id === sessionId) return sessionExists ? { _id: sessionId, userId: identity, expirationTime: Date.now() + 60_000 } : null;
    if (id === userId) return options.missingUser ? null : user;
    if (id === attackerId) return { _id: attackerId, email: 'inviter@example.test', role: 'project_admin' };
    return null;
  });
  const patch = vi.fn(async (id: string, changes: Record<string, unknown>) => {
    if (id === userId) user = { ...user, ...changes };
    else if (id === invite._id) invite = { ...invite, ...changes };
    else throw new Error('Unexpected patch target');
  });
  const insert = vi.fn(async (table: string, value: { userId: Id<'users'>; projectId: Id<'projects'> }) => {
    if (table !== 'userProjects') throw new Error('Unexpected insert table');
    memberships.push(value);
    return 'new-membership';
  });
  const query = (table: string) => makeQuery(
    table === 'invites' ? (options.missingInvite ? [] : [invite]) : table === 'userProjects' ? memberships : []);
  const ctx = {
    auth: { getUserIdentity: async () => identity === null ? null : {
      subject: `${identity}|session`, issuer: 'https://auth.example.test', tokenIdentifier: `auth|${identity}`,
    } },
    db: { get, patch, insert, query },
  } as unknown as MutationCtx;
  return { ctx, get, patch, insert, memberships, user: () => user, invite: () => invite, deleteSession: () => { sessionExists = false; } };
}

function setupFixture(options: {
  user?: Partial<Doc<'users'>>;
  account?: boolean;
  memberships?: Id<'projects'>[];
  invite?: Partial<Doc<'invites'>>;
  missingInvite?: boolean;
} = {}) {
  let user: Doc<'users'> = {
    _id: userId, _creationTime: 1, email: args.email, verified: false,
    firstCompanyName: 'Old company', name: 'Squatter', setupToken: 'old-token',
    tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(), ...options.user,
  };
  const invite: Doc<'invites'> = {
    _id: 'invitation' as Id<'invites'>, _creationTime: 1, ...args, projectId,
    role: 'project_admin', type: 'invite', used: false, createdBy: attackerId,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...options.invite,
  };
  const memberships = (options.memberships ?? []).map((id) => ({ userId, projectId: id }));
  const authAccounts = options.account === false ? [] : [{ provider: 'password', providerAccountId: args.email, userId }];
  const get = vi.fn(async (id: Id<'users'> | Id<'authSessions'>) => id === sessionId
    ? { _id: sessionId, userId, expirationTime: Date.now() + 60_000 }
    : id === userId ? user : null);
  const patch = vi.fn(async (id: string, changes: Record<string, unknown>) => {
    if (id === userId) user = { ...user, ...changes };
    else if (id === invite._id) Object.assign(invite, changes);
    else throw new Error('Unexpected patch target');
  });
  const insert = vi.fn(async (table: string, value: { userId: Id<'users'>; projectId: Id<'projects'> }) => {
    if (table !== 'userProjects') throw new Error('Unexpected insert table');
    memberships.push(value);
    return 'new-membership';
  });
  const query = (table: string) => makeQuery(
    table === 'invites' ? (options.missingInvite ? [] : [invite]) : table === 'authAccounts' ? authAccounts : table === 'userProjects' ? memberships : [],
  );
  const db = { get, patch, insert, query };
  const identity = {
    subject: `${userId}|session`, issuer: 'https://auth.example.test', tokenIdentifier: `auth|${userId}`,
  };
  return {
    queryCtx: { db } as unknown as QueryCtx,
    mutationCtx: { db, auth: { getUserIdentity: async () => identity } } as unknown as MutationCtx,
    get, patch, insert, memberships, user: () => user, invite: () => invite,
  };
}

describe('invites.setupAccountState', () => {
  it('returns none when the invited email has no password account', async () => {
    await expect(setupStateHandler(setupFixture({ account: false }).queryCtx, { token: args.token }))
      .resolves.toEqual({ state: 'none', email: args.email });
  });
  it('marks only an unverified, roleless, membership-free account claimable', async () => {
    const f = setupFixture();
    await expect(setupStateHandler(f.queryCtx, { token: args.token }))
      .resolves.toEqual({ state: 'claimable', email: args.email, userId });
  });
  it.each([
    { user: { verified: true } },
    { user: { verified: undefined } },
    { user: { role: 'project_user' as const } },
    { memberships: [otherProjectId] },
  ])('returns taken for an existing protected account: %j', async (options) => {
    await expect(setupStateHandler(setupFixture(options).queryCtx, { token: args.token }))
      .resolves.toEqual({ state: 'taken' });
  });
  it.each([
    { missingInvite: true },
    { invite: { used: true } },
    { invite: { expiresAt: new Date(0).toISOString() } },
  ])('rejects used or expired invites: %j', async (options) => {
    await expect(setupStateHandler(setupFixture(options).queryCtx, { token: args.token }))
      .rejects.toMatchObject({ data: { code: 'INVITE_INVALID' } });
  });
  it('rejects reset invites', async () => {
    await expect(setupStateHandler(setupFixture({ invite: { type: 'reset' } }).queryCtx, { token: args.token }))
      .rejects.toMatchObject({ data: { code: 'INVITE_WRONG_TYPE' } });
  });
});

describe('invites.resetClaimedAccount', () => {
  it('rechecks claimability and does not patch protected accounts', async () => {
    const f = setupFixture({ user: { verified: true } });
    await expect(resetClaimedHandler(f.mutationCtx, { userId })).rejects.toMatchObject({
      data: { code: 'INVITE_ACCOUNT_EXISTS' },
    });
    expect(f.patch).not.toHaveBeenCalled();
  });
  it('clears stale signup fields while preserving role and verification', async () => {
    const f = setupFixture();
    await resetClaimedHandler(f.mutationCtx, { userId });
    expect(f.patch).toHaveBeenCalledWith(userId, expect.objectContaining({
      firstCompanyName: undefined, name: undefined, setupToken: undefined,
      tokenExpiresAt: undefined, updatedAt: expect.any(String),
    }));
    expect(f.user()).toMatchObject({ verified: false, firstCompanyName: undefined, name: undefined });
    expect(f.user().setupToken).toBeUndefined();
    expect(f.user().tokenExpiresAt).toBeUndefined();
    expect(f.user().role).toBeUndefined();
  });
});

describe('invites.claimSetupAccount', () => {
  it('claims a squat account, invalidates sessions and then allows invite consumption', async () => {
    vi.mocked(modifyAccountCredentials).mockClear();
    vi.mocked(invalidateSessions).mockClear();
    const order: string[] = [];
    const f = setupFixture();
    const ctx = {
      runQuery: vi.fn(async () => setupStateHandler(f.queryCtx, { token: args.token })),
      runMutation: vi.fn(async () => { order.push('reset'); return resetClaimedHandler(f.mutationCtx, { userId }); }),
    } as unknown as ActionCtx;
    vi.mocked(modifyAccountCredentials).mockImplementationOnce(async () => { order.push('modify'); });
    vi.mocked(invalidateSessions).mockImplementationOnce(async () => { order.push('invalidate'); });
    await expect(claimHandler(ctx, { token: args.token, password: 'Strongpass1' }))
      .resolves.toEqual({ flow: 'signIn' });
    expect(modifyAccountCredentials).toHaveBeenCalledWith(ctx, {
      provider: 'password', account: { id: args.email, secret: 'Strongpass1' },
    });
    expect(invalidateSessions).toHaveBeenCalledWith(ctx, { userId });
    expect(ctx.runMutation).toHaveBeenCalledOnce();
    expect(order).toEqual(['reset', 'modify', 'invalidate']);
    expect(f.user()).toMatchObject({ verified: false, name: undefined, firstCompanyName: undefined });
    expect(f.user().role).toBeUndefined();
    expect(f.user().setupToken).toBeUndefined();
    expect(f.user().tokenExpiresAt).toBeUndefined();
    await handler(f.mutationCtx, args);
    expect(f.user()).toMatchObject({ role: 'project_admin', verified: true });
    expect(f.memberships).toContainEqual(expect.objectContaining({ userId, projectId }));
  });
  it('does not change credentials or invalidate sessions if the account becomes protected before reset', async () => {
    vi.mocked(modifyAccountCredentials).mockClear();
    vi.mocked(invalidateSessions).mockClear();
    const f = setupFixture();
    const runMutation = vi.fn(async () => {
      f.user().verified = true;
      return resetClaimedHandler(f.mutationCtx, { userId });
    });
    const ctx = {
      runQuery: vi.fn(async () => setupStateHandler(f.queryCtx, { token: args.token })),
      runMutation,
    } as unknown as ActionCtx;
    await expect(claimHandler(ctx, { token: args.token, password: 'Strongpass1' }))
      .rejects.toMatchObject({ data: { code: 'INVITE_ACCOUNT_EXISTS' } });
    expect(runMutation).toHaveBeenCalledOnce();
    expect(modifyAccountCredentials).not.toHaveBeenCalled();
    expect(invalidateSessions).not.toHaveBeenCalled();
  });
  it('returns signUp without writes when no account exists', async () => {
    vi.mocked(modifyAccountCredentials).mockClear();
    vi.mocked(invalidateSessions).mockClear();
    const ctx = { runQuery: vi.fn(async () => ({ state: 'none', email: args.email })), runMutation: vi.fn() } as unknown as ActionCtx;
    await expect(claimHandler(ctx, { token: args.token, password: 'Strongpass1' })).resolves.toEqual({ flow: 'signUp' });
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(modifyAccountCredentials).not.toHaveBeenCalled();
    expect(invalidateSessions).not.toHaveBeenCalled();
  });
  it('rejects taken accounts without writes', async () => {
    vi.mocked(modifyAccountCredentials).mockClear();
    vi.mocked(invalidateSessions).mockClear();
    const ctx = { runQuery: vi.fn(async () => ({ state: 'taken' })), runMutation: vi.fn() } as unknown as ActionCtx;
    await expect(claimHandler(ctx, { token: args.token, password: 'Strongpass1' }))
      .rejects.toMatchObject({ data: { code: 'INVITE_ACCOUNT_EXISTS' } });
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(modifyAccountCredentials).not.toHaveBeenCalled();
    expect(invalidateSessions).not.toHaveBeenCalled();
  });
  it('rejects weak passwords without writes', async () => {
    const ctx = { runQuery: vi.fn(async () => ({ state: 'none', email: args.email })), runMutation: vi.fn() } as unknown as ActionCtx;
    await expect(claimHandler(ctx, { token: args.token, password: 'weakpass' }))
      .rejects.toMatchObject({ data: { code: 'INVITE_WEAK_PASSWORD' } });
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(modifyAccountCredentials).not.toHaveBeenCalled();
  });
});

async function expectRejected(f: ReturnType<typeof fixture>, code: string, input = args) {
  await expect(handler(f.ctx, input)).rejects.toMatchObject({ data: { code } });
  expect(f.patch).not.toHaveBeenCalled();
  expect(f.insert).not.toHaveBeenCalled();
  expect(f.invite().used).toBe(false);
}

describe('invites.consume authorization and global role protection', () => {
  it('rejects unauthenticated token/email consumption without reading a user', async () => {
    const f = fixture({ identity: null });
    await expectRejected(f, 'INVITE_AUTH_REQUIRED');
    expect(f.get).not.toHaveBeenCalled();
  });
  it('blocks the inviting project_admin using a victim super_admin email and token', async () => {
    const f = fixture({ identity: attackerId, user: { role: 'super_admin' }, invite: { role: 'project_user' } });
    await expectRejected(f, 'INVITE_EMAIL_MISMATCH');
    expect(f.get).toHaveBeenCalledWith(attackerId);
    expect(f.get).not.toHaveBeenCalledWith(userId);
    expect(f.user().role).toBe('super_admin');
  });
  it.each([
    ['super_admin', 'project_user'],
    ['project_user', 'project_admin'],
    ['project_admin', 'project_user'],
  ] as const)('preserves existing %s when accepting %s and adds membership', async (role, inviteRole) => {
    const f = fixture({ user: { role }, invite: { role: inviteRole }, memberships: [otherProjectId] });
    await expect(handler(f.ctx, args)).resolves.toBeNull();
    expect(f.user().role).toBe(role);
    expect(f.memberships).toContainEqual(expect.objectContaining({ userId, projectId }));
    expect(f.patch.mock.calls.filter(([id]) => id === userId).every(([, patch]) => !('role' in patch))).toBe(true);
    expect(f.invite().used).toBe(true);
  });
  it.each(['project_admin', 'project_user'] as const)('assigns %s only to an unverified, roleless, membership-free setup account', async (role) => {
    const f = fixture({ user: { verified: false, role: undefined, setupToken: 'old-token' }, invite: { role } });
    await handler(f.ctx, args);
    expect(f.user()).toMatchObject({ role, verified: true });
    expect(f.user().setupToken).toBeUndefined();
    expect(f.memberships).toHaveLength(1);
  });
  it.each([
    { user: { verified: false, role: 'super_admin' as const }, memberships: [] },
    { user: { verified: false, role: undefined }, memberships: [otherProjectId] },
    { user: { verified: undefined, role: undefined }, memberships: [] },
    { user: { verified: true, role: undefined }, memberships: [] },
  ])('does not reinterpret an existing account as new: %j', async (options) => {
    const f = fixture(options);
    const oldRole = f.user().role;
    await handler(f.ctx, args);
    expect(f.user().role).toBe(oldRole);
    expect(f.patch.mock.calls.filter(([id]) => id === userId).every(([, patch]) => !('role' in patch))).toBe(true);
  });
  it('rejects reset tokens even with the matching authenticated account', async () => {
    await expectRejected(fixture({ invite: { type: 'reset' } }), 'INVITE_WRONG_TYPE');
  });
  it.each([
    { missingInvite: true },
    { invite: { expiresAt: new Date(0).toISOString() } },
    { invite: { expiresAt: 'invalid-date' } },
  ])('rejects missing or expired/malformed invites: %j', async (options) => {
    await expectRejected(fixture(options), 'INVITE_INVALID');
  });
  it('rejects a missing authenticated user document', async () => {
    await expectRejected(fixture({ missingUser: true }), 'INVITE_AUTH_REQUIRED');
  });
  it('rejects a squatter JWT after invalidateSessions deleted its session', async () => {
    const f = fixture();
    vi.mocked(invalidateSessions).mockImplementationOnce(async () => f.deleteSession());
    await invalidateSessions(f.ctx as unknown as ActionCtx, { userId });
    await expectRejected(f, 'INVITE_AUTH_REQUIRED');
  });
  it('does not authorize an account without an email using the supplied email', async () => {
    await expectRejected(fixture({ user: { email: undefined } }), 'INVITE_EMAIL_MISMATCH');
  });
  it('still checks the legacy email argument', async () => {
    await expectRejected(fixture(), 'INVITE_EMAIL_MISMATCH', { ...args, email: 'other@example.test' });
  });
  it('compares authenticated and invite emails case-insensitively and supports legacy invite type', async () => {
    const f = fixture({ user: { email: args.email.toUpperCase() }, invite: { type: undefined } });
    await expect(handler(f.ctx, { ...args, email: args.email.toUpperCase() })).resolves.toBeNull();
  });
  it('does not duplicate a membership even when the target is not the first membership', async () => {
    const f = fixture({ memberships: [otherProjectId, projectId] });
    await handler(f.ctx, args);
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.memberships).toHaveLength(2);
  });
  it('rejects a second consumption without further writes', async () => {
    const f = fixture();
    await handler(f.ctx, args);
    const patchCount = f.patch.mock.calls.length;
    await expect(handler(f.ctx, args)).rejects.toMatchObject({ data: { code: 'INVITE_INVALID' } });
    expect(f.patch).toHaveBeenCalledTimes(patchCount);
    expect(f.insert).toHaveBeenCalledOnce();
  });
});

type CreateArgs = {
  callerId: Id<'users'>;
  email: string;
  projectId: Id<'projects'>;
  role: 'project_admin' | 'project_user';
  type?: 'invite' | 'reset';
};
const registeredCreate = create as unknown as {
  _handler: (ctx: MutationCtx, args: CreateArgs) => Promise<string>;
  isInternal: boolean;
};
const createHandler = registeredCreate._handler;
const listHandler = (list as unknown as {
  _handler: (ctx: QueryCtx, args: FunctionArgs<typeof api.invites.list>) => Promise<FunctionReturnType<typeof api.invites.list>>;
})._handler;

function createFixture(options: {
  caller?: Partial<Doc<'users'>> | null;
  owner?: Id<'users'>;
  memberships?: Id<'projects'>[];
  existingEmails?: string[];
} = {}) {
  const callerId = attackerId;
  const caller = options.caller === null ? null : {
    _id: callerId, _creationTime: 1, email: 'inviter@example.test', role: 'super_admin' as const, verified: true,
    ...options.caller,
  };
  const memberships: Record<string, unknown>[] = (options.memberships ?? []).map((membershipProjectId) => ({ userId: callerId, projectId: membershipProjectId }));
  const invites: Record<string, unknown>[] = (options.existingEmails ?? []).map((email, index) => ({
    _id: `old-${index}` as Id<'invites'>, email, used: false,
  }));
  const inserted: Record<string, unknown>[] = [];
  const patched: Record<string, unknown>[] = [];
  const project = { _id: projectId, _creationTime: 1, ownerId: options.owner ?? userId };
  const query = (table: string) => makeQuery(table === 'userProjects' ? memberships : table === 'invites' ? invites : []);
  const ctx = { db: {
    get: async (id: Id<'users'> | Id<'projects'>) => id === callerId ? caller : id === projectId ? project : null,
    query,
    patch: async (id: Id<'invites'>, changes: Record<string, unknown>) => { patched.push({ id, ...changes }); },
    insert: async (_table: string, value: Record<string, unknown>) => { inserted.push(value); return 'new-invite'; },
  } } as unknown as MutationCtx;
  return { ctx, callerId, inserted, patched };
}

describe('invites.create internal authorization', () => {
  const input = (callerId: Id<'users'>) => ({ callerId, email: 'New.User@example.test', projectId, role: 'project_user' as const });

  it('is internal only', () => {
    expect(registeredCreate.isInternal).toBe(true);
  });
  it('allows super_admin and lowercases the inserted email', async () => {
    const f = createFixture();
    await expect(createHandler(f.ctx, input(f.callerId))).resolves.toEqual(expect.any(String));
    expect(f.inserted[0]).toMatchObject({ email: 'new.user@example.test', createdBy: f.callerId });
    expect(limiter.limit).toHaveBeenCalledWith(f.ctx, 'inviteCreate', { key: f.callerId, throws: true });
  });
  it('allows the project owner', async () => {
    const f = createFixture({ caller: { role: 'project_user' }, owner: attackerId });
    await expect(createHandler(f.ctx, input(f.callerId))).resolves.toEqual(expect.any(String));
  });
  it('allows a project_admin who belongs to the project', async () => {
    const f = createFixture({ caller: { role: 'project_admin' }, memberships: [projectId] });
    await expect(createHandler(f.ctx, input(f.callerId))).resolves.toEqual(expect.any(String));
  });
  it('rejects a project_admin outside the project without inserting', async () => {
    const f = createFixture({ caller: { role: 'project_admin' } });
    await expect(createHandler(f.ctx, input(f.callerId))).rejects.toThrow('yetkin yok');
    expect(f.inserted).toHaveLength(0);
  });
  it('rejects project_user without inserting', async () => {
    const f = createFixture({ caller: { role: 'project_user' } });
    await expect(createHandler(f.ctx, input(f.callerId))).rejects.toThrow('yetkin yok');
    expect(f.inserted).toHaveLength(0);
  });
  it.each([{ caller: null }, { caller: { verified: false } }])('rejects absent or unverified caller: %j', async (options) => {
    const f = createFixture(options);
    await expect(createHandler(f.ctx, input(f.callerId))).rejects.toThrow('Giriş yapmanız gerekiyor');
    expect(f.inserted).toHaveLength(0);
  });
  it('marks all previous unused invitations for the email as used', async () => {
    const f = createFixture({ existingEmails: ['new.user@example.test', 'new.user@example.test'] });
    await createHandler(f.ctx, input(f.callerId));
    expect(f.patched).toHaveLength(2);
    expect(f.patched.every((patch) => patch.used === true)).toBe(true);
  });
});

describe('invites.list response contract', () => {
  it('omits private fields and filters by project', async () => {
    const rows = [
      { _id: 'invite-a' as Id<'invites'>, _creationTime: 1, email: 'a@example.test', token: 'secret-a', projectId, role: 'project_user' as const, type: 'invite', createdBy: attackerId, expiresAt: '2030-01-01', used: false, createdAt: '2026-01-01' },
      { _id: 'invite-b' as Id<'invites'>, _creationTime: 2, email: 'b@example.test', token: 'secret-b', projectId: otherProjectId, role: 'project_admin' as const, type: 'reset', createdBy: attackerId, expiresAt: '2030-01-02', used: true, createdAt: '2026-01-02' },
    ];
    const ctx = { db: { query: () => makeQuery(rows) } } as unknown as QueryCtx;
    const result = await listHandler(ctx, { projectId });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _id: 'invite-a', email: 'a@example.test', projectId, role: 'project_user' });
    for (const key of ['token', 'type', 'createdBy', '_creationTime']) expect(result[0]).not.toHaveProperty(key);
  });
});
