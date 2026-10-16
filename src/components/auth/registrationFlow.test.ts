import { describe, expect, it, vi } from 'vitest';
import { deferAuthGuard, registerAccount } from './registrationFlow';

describe('hesap kayıt sonucu', () => {
  it('mail hatasında mevcut hesapla devam eder ve oturumu kapatır', async () => {
    const signOut = vi.fn(async () => {});
    const result = await registerAccount({ createAccount: async () => {}, requestVerification: async () => { throw new Error('mail'); }, signOut });
    expect(result).toEqual({ error: null, accountCreated: true, verificationQueued: false });
    expect(signOut).toHaveBeenCalledOnce();
  });
  it('hesap hatasında mail istemez ve ilk hatayı korur', async () => {
    const error = new Error('create');
    const requestVerification = vi.fn(async () => {});
    const result = await registerAccount({ createAccount: async () => { throw error; }, requestVerification, signOut: async () => {} });
    expect(result.error).toBe(error);
    expect(result.accountCreated).toBe(false);
    expect(requestVerification).not.toHaveBeenCalled();
  });
  it('temizlik hatasında başarılı mail talebini korur', async () => {
    const result = await registerAccount({ createAccount: async () => {}, requestVerification: async () => {}, signOut: async () => { throw new Error('logout'); } });
    expect(result).toEqual({ error: null, accountCreated: true, verificationQueued: true });
  });
  it('erken profil bildiriminde kurulum akışını bölmez; normal girişte guard sürer', () => {
    expect(deferAuthGuard('/user-setup', false, true)).toBe(true);
    expect(deferAuthGuard('/admin-setup', false, true)).toBe(true);
    expect(deferAuthGuard('/register', true)).toBe(true);
    expect(deferAuthGuard('/login', false)).toBe(false);
    expect(deferAuthGuard('/home', false, true)).toBe(false);
    expect(deferAuthGuard('/user-setup', false, false)).toBe(false);
  });
});
