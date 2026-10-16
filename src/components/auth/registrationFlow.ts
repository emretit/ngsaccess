export interface RegistrationResult {
  error: unknown | null;
  accountCreated: boolean;
  verificationQueued: boolean;
}

/** E-posta talebinin başarısızlığı oluşturulmuş hesabı kayıt hatasına çevirmez. */
export async function registerAccount(steps: {
  createAccount: () => Promise<unknown>;
  requestVerification: () => Promise<unknown>;
  signOut: () => Promise<unknown>;
}): Promise<RegistrationResult> {
  let accountCreated = false;
  let verificationQueued = false;
  try {
    await steps.createAccount();
    accountCreated = true;
    await steps.requestVerification();
    verificationQueued = true;
    return { error: null, accountCreated, verificationQueued };
  } catch (error: unknown) {
    return { error: accountCreated ? null : error, accountCreated, verificationQueued };
  } finally {
    try { await steps.signOut(); } catch { /* Provider doğrulanmamış oturumu ayrıca engeller. */ }
  }
}

export function deferAuthGuard(pathname: string, signupPending: boolean, setupActive = false) {
  return signupPending || (setupActive && (pathname === '/user-setup' || pathname === '/admin-setup'));
}
